import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Octokit } from 'octokit';
import { ComposerJson, GraphData, AnalysisProgress, Repository, OrganizationCache, CachedRepository } from '../types';

const TWO_WEEKS = 1000 * 60 * 60 * 24 * 14; // 2 weeks in milliseconds
const REPO_CACHE_EXPIRY = 1000 * 60 * 60 * 24; // 24 hours

function decodeBase64(base64: string): string {
  const binaryString = atob(base64.replace(/\s/g, ''));
  return binaryString;
}

function normalizeRepoName(name: string, organization: string): string {
  const [orgName, repoName] = name.split('/');
  return `${organization}/${repoName.toLowerCase()}`;
}

function getPackageId(repoName: string, composerName: string): string {
  return `${repoName}||${composerName}`;
}

function extractDependencies(composerJson: ComposerJson, organization: string): Set<string> {
  const deps = new Set<string>();
  const orgLower = organization.toLowerCase();

  const allDeps = {
    ...composerJson.require,
    ...composerJson['require-dev'],
  };

  Object.entries(allDeps).forEach(([dep, version]) => {
    const depLower = dep.toLowerCase();
    if (depLower.startsWith(`${orgLower}/`)) {
      deps.add(normalizeRepoName(dep, organization));
    }
  });

  if (composerJson.repositories) {
    Object.entries(composerJson.repositories).forEach(([name, repo]) => {
      if (
          typeof repo === 'object' &&
          repo !== null &&
          'url' in repo &&
          typeof repo.url === 'string'
      ) {
        const url = repo.url.toLowerCase();
        const orgVariations = [`/${orgLower}/`, `/${organization}/`];

        if (url.includes('github.com') && orgVariations.some(v => url.includes(v))) {
          const match = url.match(/github\.com\/[^\/]+\/([^\/\.]+)/i);
          if (match) {
            const repoName = match[1].toLowerCase();
            deps.add(`${organization}/${repoName}`);
          }
        }
      }
    });
  }

  return deps;
}

async function findComposerFiles(octokit: Octokit, owner: string, repo: string): Promise<string[]> {
  try {
    const { data: repoData } = await octokit.rest.repos.get({
      owner,
      repo,
      request: {
        timeout: 10000
      }
    });

    const defaultBranch = repoData.default_branch;

    try {
      const { data: tree } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: defaultBranch,
        recursive: '1',
        request: {
          timeout: 10000
        }
      });

      return tree.tree
          .filter(item =>
              item.type === 'blob' &&
              item.path?.toLowerCase().endsWith('composer.json')
          )
          .map(item => item.path!)
          .filter(Boolean);
    } catch (error) {
      console.warn(`Error fetching tree for ${owner}/${repo}, falling back to manual checks:`, error);
      return [];
    }
  } catch (error) {
    console.error(`Error processing repo ${owner}/${repo}:`, error);
    return [];
  }
}

async function getComposerLock(octokit: Octokit, owner: string, repo: string, path: string): Promise<any | null> {
  try {
    const lockPath = path.replace('composer.json', 'composer.lock');
    const { data: file } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: lockPath,
      request: {
        timeout: 10000
      }
    });

    if ('content' in file) {
      const content = decodeBase64(file.content);
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn(`Error fetching composer.lock for ${owner}/${repo}:`, error);
  }
  return null;
}

interface GithubState {
  token: string;
  organization: string;
  organizations: Array<{ login: string; name: string | null }>;
  repositories: Repository[];
  isValidatingToken: boolean;
  isLoadingOrgs: boolean;
  isLoadingRepos: boolean;
  isLoading: boolean;
  graphData: GraphData;
  error: string | null;
  progress: AnalysisProgress | null;
  orgCache: Record<string, OrganizationCache>;
  hasAttemptedFetch: boolean;
}

interface GithubActions {
  setToken: (token: string) => void;
  setOrganization: (org: string) => void;
  validateToken: () => Promise<boolean>;
  fetchOrganizations: () => Promise<void>;
  fetchRepositories: () => Promise<void>;
  fetchDependencies: () => Promise<void>;
  toggleRepository: (repoName: string) => void;
  selectAllRepositories: () => void;
  deselectAllRepositories: () => void;
  reset: () => void;
  clearError: () => void;
}

export const useGithubStore = create<GithubState & GithubActions>()(
    persist(
        (set, get) => ({
          token: '',
          organization: '',
          organizations: [],
          repositories: [],
          isValidatingToken: false,
          isLoadingOrgs: false,
          isLoadingRepos: false,
          isLoading: false,
          graphData: { nodes: [], links: [] },
          error: null,
          progress: null,
          orgCache: {},
          hasAttemptedFetch: false,

          setToken: (token: string) => {
            set({ token, error: null });
            if (token) {
              get().fetchOrganizations();
            }
          },

          setOrganization: (org: string) => {
            set({ organization: org, error: null, repositories: [] });
          },

          toggleRepository: (repoName: string) => {
            set(state => ({
              repositories: state.repositories.map(repo =>
                  repo.name === repoName ? { ...repo, selected: !repo.selected } : repo
              )
            }));
          },

          selectAllRepositories: () => {
            set(state => ({
              repositories: state.repositories.map(repo => ({ ...repo, selected: true }))
            }));
          },

          deselectAllRepositories: () => {
            set(state => ({
              repositories: state.repositories.map(repo => ({ ...repo, selected: false }))
            }));
          },

          clearError: () => {
            set({ error: null });
          },

          validateToken: async () => {
            const { token } = get();
            set({ isValidatingToken: true, error: null });

            try {
              const octokit = new Octokit({ auth: token });
              await octokit.rest.users.getAuthenticated();
              set({ isValidatingToken: false });
              return true;
            } catch (error) {
              set({
                error: 'Invalid token. Please check your GitHub Personal Access Token.',
                isValidatingToken: false,
                token: '',
              });
              return false;
            }
          },

          fetchOrganizations: async () => {
            const { token } = get();
            set({ isLoadingOrgs: true, error: null });

            try {
              const octokit = new Octokit({ auth: token });
              const orgs = await octokit.paginate('GET /user/orgs', {
                per_page: 100,
              });

              set({
                organizations: orgs.map(org => ({
                  login: org.login,
                  name: org.name,
                })),
                isLoadingOrgs: false,
              });
            } catch (error) {
              set({
                error: 'Failed to fetch organizations.',
                isLoadingOrgs: false,
                organizations: [],
              });
            }
          },

          fetchRepositories: async () => {
            const { token, organization, orgCache } = get();
            set({ isLoadingRepos: true, error: null });

            try {
              const cachedData = orgCache[organization];
              const now = Date.now();

              if (cachedData && now - cachedData.timestamp < REPO_CACHE_EXPIRY) {
                set({
                  repositories: cachedData.repositories.map(repo => ({
                    ...repo,
                    selected: true
                  })),
                  isLoadingRepos: false
                });
                return;
              }

              const octokit = new Octokit({ auth: token });
              const repos = await octokit.paginate('GET /orgs/{org}/repos', {
                org: organization,
                per_page: 100
              });

              const activeRepos = repos
                  .filter((repo: Repository) => {
                    const pushedAt = new Date(repo.pushed_at).getTime();
                    return !repo.archived && (now - pushedAt <= TWO_WEEKS);
                  })
                  .map(repo => ({
                    name: repo.name,
                    archived: repo.archived,
                    pushed_at: repo.pushed_at,
                    selected: true,
                    cachedAt: now
                  }));

              set(state => ({
                repositories: activeRepos,
                orgCache: {
                  ...state.orgCache,
                  [organization]: {
                    repositories: activeRepos,
                    timestamp: now
                  }
                },
                isLoadingRepos: false
              }));
            } catch (error) {
              set({
                error: 'Failed to fetch repositories.',
                isLoadingRepos: false,
                repositories: []
              });
            }
          },

          fetchDependencies: async () => {
            const { token, organization, repositories } = get();
            const selectedRepos = repositories.filter(repo => repo.selected);

            if (!selectedRepos.length) {
              set({ error: 'Please select at least one repository' });
              return;
            }

            set({
              isLoading: true,
              error: null,
              progress: null,
              graphData: { nodes: [], links: [] },
              hasAttemptedFetch: true
            });

            const nodes = new Map();
            const links: GraphData['links'] = [];
            const processedDeps = new Set<string>();
            const versionMap = new Map<string, string>();
            const packageMap = new Map<string, string>();

            try {
              const octokit = new Octokit({
                auth: token,
                request: {
                  timeout: 10000
                }
              });

              for (const [index, repo] of selectedRepos.entries()) {
                const composerFiles = await findComposerFiles(octokit, organization, repo.name);
                const isPhp = composerFiles.length > 0;
                const dependencies: string[] = [];

                for (const composerPath of composerFiles) {
                  try {
                    const { data: file } = await octokit.rest.repos.getContent({
                      owner: organization,
                      repo: repo.name,
                      path: composerPath,
                      request: {
                        timeout: 10000
                      }
                    });

                    if ('content' in file) {
                      const content = decodeBase64(file.content);
                      const composerJson: ComposerJson = JSON.parse(content);
                      const deps = extractDependencies(composerJson, organization);

                      const composerLock = await getComposerLock(octokit, organization, repo.name, composerPath);

                      const packageName = composerJson.name?.toLowerCase();
                      if (!packageName) continue;

                      // Create a unique ID for this package in the monorepo
                      const packageId = getPackageId(`${organization}/${repo.name}`.toLowerCase(), packageName);
                      packageMap.set(packageName, packageId);

                      deps.forEach(dep => {
                        const normalizedDep = dep.toLowerCase();
                        if (!dependencies.includes(normalizedDep)) {
                          dependencies.push(normalizedDep);
                        }

                        if (composerLock) {
                          const allPackages = [
                            ...(composerLock.packages || []),
                            ...(composerLock['packages-dev'] || [])
                          ];
                          const lockPackage = allPackages.find(p => p.name.toLowerCase() === normalizedDep);
                          if (lockPackage) {
                            versionMap.set(normalizedDep, lockPackage.version);
                          }
                        }
                      });

                      if (!nodes.has(packageId)) {
                        nodes.set(packageId, {
                          id: packageId,
                          name: packageName.split('/')[1],
                          version: composerJson.version || 'dev-main',
                          color: '#2563eb',
                        });
                      }

                      deps.forEach(dep => {
                        const normalizedDep = dep.toLowerCase();
                        const depId = packageMap.get(normalizedDep) || normalizedDep;

                        if (!nodes.has(depId)) {
                          nodes.set(depId, {
                            id: depId,
                            name: normalizedDep.split('/')[1],
                            version: versionMap.get(normalizedDep) || 'dev-main',
                            color: '#059669',
                          });
                        }

                        const linkKey = `${packageId}-${depId}`;
                        if (!processedDeps.has(linkKey)) {
                          const version = versionMap.get(normalizedDep) ||
                              composerJson.require?.[dep] ||
                              composerJson['require-dev']?.[dep] ||
                              'dev-main';

                          links.push({
                            source: packageId,
                            target: depId,
                            version
                          });
                          processedDeps.add(linkKey);
                        }
                      });
                    }
                  } catch (error) {
                    console.warn(`Error processing composer file ${composerPath} in ${repo.name}:`, error);
                  }
                }

                set({
                  progress: {
                    total: selectedRepos.length,
                    current: index + 1,
                    currentRepo: repo.name,
                    isPhp,
                    dependencies
                  }
                });
              }

              const graphData = {
                nodes: Array.from(nodes.values()),
                links,
              };

              if (graphData.nodes.length === 0) {
                set({
                  error: 'No internal dependencies found between projects.',
                  isLoading: false,
                  progress: null,
                });
                return;
              }

              set({
                graphData,
                isLoading: false,
                progress: null,
              });
            } catch (error) {
              set({
                error: 'Failed to fetch dependencies. Please check your token and organization.',
                isLoading: false,
                progress: null,
                graphData: { nodes: [], links: [] },
              });
            }
          },

          reset: () => {
            set({
              token: '',
              organization: '',
              organizations: [],
              repositories: [],
              graphData: { nodes: [], links: [] },
              error: null,
              progress: null,
              hasAttemptedFetch: false,
            });
          },
        }),
        {
          name: 'github-deps-store',
          partialize: (state) => ({
            token: state.token,
            orgCache: state.orgCache,
          }),
          onRehydrateStorage: () => (state) => {
            if (state?.token) {
              state.fetchOrganizations();
            }
          },
        }
    )
);