import { StateCreator } from 'zustand';
import { Octokit } from 'octokit';
import { AuthSlice } from './authSlice';
import { OrganizationSlice } from './organizationSlice';
import { RepositorySlice } from './repositorySlice';
import { GraphData, AnalysisProgress } from '../../types';
import { 
  extractDependencies, 
  getComposerLock, 
  findComposerFiles, 
  normalizeRepoName, 
  getPackageId, 
  decodeBase64,
  getLatestTag 
} from '../utils/dependencyUtils';

export interface DependencyState {
  graphData: GraphData;
  isLoading: boolean;
  progress: AnalysisProgress | null;
  hasAttemptedFetch: boolean;
}

export interface DependencyActions {
  fetchDependencies: () => Promise<void>;
  clearGraph: () => void;
  reset: () => void;
}

export type DependencySlice = DependencyState & DependencyActions;

type DependencySliceWithDeps = DependencySlice & AuthSlice & OrganizationSlice & RepositorySlice;

export const createDependencySlice: StateCreator<
  DependencySliceWithDeps,
  [],
  [],
  DependencySlice
> = (set, get) => ({
  graphData: { nodes: [], links: [] },
  isLoading: false,
  progress: null,
  hasAttemptedFetch: false,

  clearGraph: () => {
    set({
      graphData: { nodes: [], links: [] },
      isLoading: false,
      progress: null,
      hasAttemptedFetch: false,
    });
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

        // Get latest tag for the repository
        const latestTag = await getLatestTag(octokit, organization, repo.name);

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
              const composerJson: any = JSON.parse(content);
              const deps = extractDependencies(composerJson, organization);

              const composerLock = await getComposerLock(octokit, organization, repo.name, composerPath);

              const packageName = composerJson.name?.toLowerCase();
              if (!packageName) continue;

              // Check if this is part of a monorepo
              const isMonorepo = composerPath !== 'composer.json';
              const monorepoName = isMonorepo ? repo.name : undefined;

              // Create a unique ID for this package
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
                  version: latestTag || composerJson.version || 'dev-main',
                  color: isMonorepo ? '#9333ea' : '#2563eb', // Purple for monorepo services, blue for standalone
                  isMonorepo,
                  monorepoName,
                  composerFiles: [composerPath],
                  defaultBranch: repo.defaultBranch
                });
              } else {
                // Update existing node with additional composer file
                const existingNode = nodes.get(packageId);
                existingNode.composerFiles = [...(existingNode.composerFiles || []), composerPath];
                nodes.set(packageId, existingNode);
              }

              deps.forEach(async dep => {
                const normalizedDep = dep.toLowerCase();
                const depId = packageMap.get(normalizedDep) || normalizedDep;

                if (!nodes.has(depId)) {
                  // Get latest tag for dependency
                  const [, depRepo] = normalizedDep.split('/');
                  const depLatestTag = await getLatestTag(octokit, organization, depRepo);

                  nodes.set(depId, {
                    id: depId,
                    name: normalizedDep.split('/')[1],
                    version: depLatestTag || versionMap.get(normalizedDep) || 'dev-main',
                    color: '#059669', // Green for dependencies
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
      console.error('Error fetching dependencies:', error);
      set({
        error: 'Failed to fetch dependencies. Please check your token and organization.',
        isLoading: false,
        progress: null,
        graphData: { nodes: [], links: [] },
      });
    }
  },

  reset: () => {
    // Clear localStorage
    localStorage.removeItem('github-deps-store');
    
    // Reset all state
    set({
      // Auth state
      token: '',
      isValidatingToken: false,
      error: null,

      // Organization state
      organization: '',
      organizations: [],
      isLoadingOrgs: false,

      // Repository state
      repositories: [],
      isLoadingRepos: false,
      orgCache: {},

      // Dependency state
      graphData: { nodes: [], links: [] },
      isLoading: false,
      progress: null,
      hasAttemptedFetch: false,
    });
  },
});