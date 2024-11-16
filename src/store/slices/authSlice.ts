import { StateCreator } from 'zustand';
import { Octokit } from 'octokit';

export interface AuthState {
  token: string;
  isValidatingToken: boolean;
  error: string | null;
}

export interface AuthActions {
  setToken: (token: string) => void;
  validateToken: () => Promise<boolean>;
  clearError: () => void;
}

export type AuthSlice = AuthState & AuthActions;

export const createAuthSlice: StateCreator<AuthSlice> = (set, get) => ({
  token: '',
  isValidatingToken: false,
  error: null,

  setToken: (token: string) => {
    set({ token, error: null });
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

  clearError: () => {
    set({ error: null });
  },
});