import { StateCreator } from 'zustand';
import { Octokit } from 'octokit';
import { AuthSlice } from './authSlice';
import { OrganizationSlice } from './organizationSlice';
import { RepositorySlice } from './repositorySlice';
import { GraphData, AnalysisProgress, ComposerJson } from '../../types';
import { extractDependencies, getComposerLock, findComposerFiles, normalizeRepoName, getPackageId, decodeBase64 } from '../utils/dependencyUtils';

const COLORS = {
  MONOREPO_SERVICE: '#9333ea', // Purple for monorepo services
  PROJECT: '#2563eb',          // Blue for standalone projects
  DEPENDENCY: '#059669'        // Green for dependencies
};

export interface DependencyState {
  graphData: GraphData;
  isLoading: boolean;
  progress: AnalysisProgress | null;
  hasAttemptedFetch: boolean;
}

export interface DependencyActions {
  fetchDependencies: () => Promise<void>;
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
    const repoPackages = new Map<string, Set<string>>();

    try {
      const octokit = new Octokit({
        auth: token,
        request: { timeout: 10000 }
      });

      // First pass: collect all packages per repository
      for (const repo of selectedRepos) {
        const composerFiles = await findComposerFiles(octokit, organization, repo.name);
        const packages = new Set<string>();

        for (const composerPath of composerFiles) {
          try {
            const { data: file } = await octokit.rest.repos.getContent({
              owner: organization,
              repo: repo.name,
              path: composerPath,
              request: { timeout: 10000 }
            });

            if ('content' in file) {
              const content = decodeBase64(file.content);
              const composerJson: ComposerJson = JSON.parse(content);
              if (composerJson.name) {
                packages.add(composerJson.name.toLowerCase());
              }
            }
          } catch (error) {
            console.warn(`Error reading composer file ${composerPath} in ${repo.name}:`, error);
          }
        }

        if (packages.size > 0) {
          repoPackages.set(repo.name, packages);
        }
      }

      // Second pass: analyze dependencies
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
              request: { timeout: 10000 }
            });

            if ('content' in file) {
              const content = decodeBase64(file.content);
              const composerJson: ComposerJson = JSON.parse(content);
              const deps = extractDependencies(composerJson, organization);
              const composerLock = await getComposerLock(octokit, organization, repo.name, composerPath);

              const packageName = composerJson.name?.toLowerCase();
              if (!packageName) continue;

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

              // Determine if this package is part of a monorepo
              const isMonorepoService = repoPackages.get(repo.name)?.size > 1;

              if (!nodes.has(packageId)) {
                nodes.set(packageId, {
                  id: packageId,
                  name: packageName.split('/')[1],
                  version: composerJson.version || 'dev-main',
                  color: isMonorepoService ? COLORS.MONOREPO_SERVICE : COLORS.PROJECT,
                });
              }

              deps.forEach(dep => {
                const normalizedDep = dep.toLowerCase();
                const depId = packageMap.get(normalizedDep) || normalizedDep;

                if (!nodes.has(depId)) {
                  // Check if the dependency is from a monorepo
                  const depRepo = selectedRepos.find(r => {
                    const packages = repoPackages.get(r.name);
                    return packages?.has(normalizedDep);
                  });
                  const isMonorepoDep = depRepo && repoPackages.get(depRepo.name)?.size > 1;

                  nodes.set(depId, {
                    id: depId,
                    name: normalizedDep.split('/')[1],
                    version: versionMap.get(normalizedDep) || 'dev-main',
                    color: isMonorepoDep ? COLORS.MONOREPO_SERVICE : COLORS.DEPENDENCY,
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
});