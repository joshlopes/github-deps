import { StateCreator } from 'zustand';
import { Octokit } from 'octokit';
import { AuthSlice } from './authSlice';
import { OrganizationSlice } from './organizationSlice';
import { Repository, CachedRepository } from '../../types';

const TWO_WEEKS = 1000 * 60 * 60 * 24 * 14;
const REPO_CACHE_EXPIRY = 1000 * 60 * 60 * 24;

interface RepositoryCache {
  repositories: CachedRepository[];
  timestamp: number;
}

export interface RepositoryState {
  repositories: Repository[];
  isLoadingRepos: boolean;
  orgCache: Record<string, RepositoryCache>;
}

export interface RepositoryActions {
  fetchRepositories: () => Promise<void>;
  toggleRepository: (repoName: string) => void;
  selectAllRepositories: () => void;
  deselectAllRepositories: () => void;
}

export type RepositorySlice = RepositoryState & RepositoryActions;

type RepositorySliceWithDeps = RepositorySlice & AuthSlice & OrganizationSlice;

export const createRepositorySlice: StateCreator<
  RepositorySliceWithDeps,
  [],
  [],
  RepositorySlice
> = (set, get) => ({
  repositories: [],
  isLoadingRepos: false,
  orgCache: {},

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
      const repos = await octokit.paginate(octokit.rest.repos.listForOrg, {
        org: organization,
        per_page: 100,
        request: {
          timeout: 10000
        }
      });

      const activeRepos = await Promise.all(
        repos
          .filter((repo: any) => {
            const pushedAt = new Date(repo.pushed_at).getTime();
            return !repo.archived && (now - pushedAt <= TWO_WEEKS);
          })
          .map(async (repo: any) => {
            try {
              // Fetch repository details to get the default branch
              const { data: repoDetails } = await octokit.rest.repos.get({
                owner: organization,
                repo: repo.name,
                request: {
                  timeout: 10000
                }
              });

              return {
                name: repo.name,
                archived: repo.archived,
                pushed_at: repo.pushed_at,
                selected: true,
                defaultBranch: repoDetails.default_branch || 'main', // Fallback to 'main' if not found
                cachedAt: now
              };
            } catch (error) {
              console.warn(`Error fetching details for ${repo.name}:`, error);
              // Fallback values if the API call fails
              return {
                name: repo.name,
                archived: repo.archived,
                pushed_at: repo.pushed_at,
                selected: true,
                defaultBranch: repo.default_branch || 'main',
                cachedAt: now
              };
            }
          })
      );

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
      console.error('Error fetching repositories:', error);
      set({
        error: 'Failed to fetch repositories.',
        isLoadingRepos: false,
        repositories: []
      });
    }
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
});