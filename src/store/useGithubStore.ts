import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Octokit } from 'octokit';
import { ComposerJson, GraphData, CacheData, AnalysisProgress, Repository } from '../types';

const CACHE_EXPIRY = 1000 * 60 * 60; // 1 hour
const TWO_WEEKS = 1000 * 60 * 60 * 24 * 14; // 2 weeks in milliseconds

interface GithubState {
  token: string;
  organization: string;
  organizations: Array<{ login: string; name: string | null }>;
  isValidatingToken: boolean;
  isLoadingOrgs: boolean;
  isLoading: boolean;
  graphData: GraphData;
  error: string | null;
  progress: AnalysisProgress | null;
  cache: Record<string, CacheData>;
  hasAttemptedFetch: boolean;
}

interface GithubActions {
  setToken: (token: string) => void;
  setOrganization: (org: string) => void;
  validateToken: () => Promise<boolean>;
  fetchOrganizations: () => Promise<void>;
  fetchDependencies: () => Promise<void>;
  reset: () => void;
  clearError: () => void;
  clearCache: (org: string) => void;
}

function decodeBase64(base64: string): string {
  const binaryString = atob(base64.replace(/\s/g, ''));
  return binaryString;
}

function normalizeRepoName(name: string, organization: string): string {
  const [orgName, repoName] = name.split('/');
  return `${organization}/${repoName.toLowerCase()}`;
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

export const useGithubStore = create<GithubState & GithubActions>()(
    persist(
        (set, get) => ({
          token: '',
          organization: '',
          organizations: [],
          isValidatingToken: false,
          isLoadingOrgs: false,
          isLoading: false,
          graphData: { nodes: [], links: [] },
          error: null,
          progress: null,
          cache: {},
          hasAttemptedFetch: false,

          setToken: (token: string) => {
            set({ token, error: null });
          },

          setOrganization: (org: string) => {
            set({ organization: org, error: null });
          },

          clearError: () => {
            set({ error: null });
          },

          clearCache: (org: string) => {
            set(state => ({
              cache: {
                ...state.cache,
                [org]: undefined
              }
            }));
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

          fetchDependencies: async () => {
            const { token, organization, cache } = get();

            if (!organization) {
              set({ error: 'Please provide organization' });
              return;
            }

            set({
              isLoading: true,
              error: null,
              progress: null,
              graphData: { nodes: [], links: [] },
              hasAttemptedFetch: true
            });

            const cachedData = cache[organization];
            if (cachedData && Date.now() - cachedData.timestamp < CACHE_EXPIRY) {
              set({
                graphData: cachedData.graphData,
                isLoading: false,
                progress: null,
              });
              return;
            }

            const octokit = new Octokit({
              auth: token,
              request: {
                timeout: 10000
              }
            });

            const nodes = new Map();
            const links: GraphData['links'] = [];
            const processedDeps = new Set<string>();

            try {
              const repos = await octokit.paginate('GET /orgs/{org}/repos', {
                org: organization,
                per_page: 100
              });

              const now = new Date().getTime();
              const activeRepos = repos.filter((repo: Repository) => {
                const pushedAt = new Date(repo.pushed_at).getTime();
                return !repo.archived && (now - pushedAt <= TWO_WEEKS);
              });

              for (const [index, repo] of activeRepos.entries()) {
                const normalizedRepoName = repo.name.toLowerCase();
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

                      deps.forEach(dep => {
                        const normalizedDep = dep.toLowerCase();
                        if (!dependencies.includes(normalizedDep)) {
                          dependencies.push(normalizedDep);
                        }
                      });

                      const repoId = `${organization}/${normalizedRepoName}`;
                      if (!nodes.has(repoId.toLowerCase())) {
                        nodes.set(repoId.toLowerCase(), {
                          id: repoId.toLowerCase(),
                          name: normalizedRepoName,
                          version: composerJson.version || 'latest',
                          color: '#2563eb',
                        });
                      }

                      deps.forEach(dep => {
                        const normalizedDep = dep.toLowerCase();
                        if (!nodes.has(normalizedDep)) {
                          nodes.set(normalizedDep, {
                            id: normalizedDep,
                            name: normalizedDep.split('/')[1],
                            version: 'latest',
                            color: '#059669',
                          });
                        }

                        const linkKey = `${repoId.toLowerCase()}-${normalizedDep}`;
                        if (!processedDeps.has(linkKey)) {
                          links.push({
                            source: repoId.toLowerCase(),
                            target: normalizedDep,
                            version: composerJson.require?.[dep] ||
                                composerJson['require-dev']?.[dep] ||
                                'latest',
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
                    total: activeRepos.length,
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

              set(state => ({
                graphData,
                cache: {
                  ...state.cache,
                  [organization]: {
                    timestamp: Date.now(),
                    graphData,
                  }
                },
                isLoading: false,
                progress: null,
              }));
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
            cache: state.cache,
          }),
        }
    )
);