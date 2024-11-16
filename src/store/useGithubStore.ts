import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAuthSlice, AuthSlice } from './slices/authSlice';
import { createOrganizationSlice, OrganizationSlice } from './slices/organizationSlice';
import { createRepositorySlice, RepositorySlice } from './slices/repositorySlice';
import { createDependencySlice, DependencySlice } from './slices/dependencySlice';

type GithubStore = AuthSlice & OrganizationSlice & RepositorySlice & DependencySlice;

export const useGithubStore = create<GithubStore>()(
  persist(
    (...a) => ({
      ...createAuthSlice(...a),
      ...createOrganizationSlice(...a),
      ...createRepositorySlice(...a),
      ...createDependencySlice(...a),
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