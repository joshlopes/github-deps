import { StateCreator } from 'zustand';
import { Octokit } from 'octokit';
import { AuthSlice } from './authSlice';

interface Organization {
  login: string;
  name: string | null;
}

export interface OrganizationState {
  organization: string;
  organizations: Organization[];
  isLoadingOrgs: boolean;
}

export interface OrganizationActions {
  setOrganization: (org: string) => void;
  fetchOrganizations: () => Promise<void>;
}

export type OrganizationSlice = OrganizationState & OrganizationActions;

type OrganizationSliceWithAuth = OrganizationSlice & AuthSlice;

export const createOrganizationSlice: StateCreator<
  OrganizationSliceWithAuth,
  [],
  [],
  OrganizationSlice
> = (set, get) => ({
  organization: '',
  organizations: [],
  isLoadingOrgs: false,

  setOrganization: (org: string) => {
    set({ organization: org, error: null });
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
          name: org.login, // Using login as name since name property doesn't exist
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
});