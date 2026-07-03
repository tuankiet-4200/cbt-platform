import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'USER';
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  // Actions
  setAuth: (user: AuthUser, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true }),

      setAccessToken: (accessToken) =>
        set({ accessToken }),

      logout: () =>
        set({ user: null, accessToken: null, isAuthenticated: false }),
    }),
    {
      name: 'cbt-auth',
      storage: createJSONStorage(() => sessionStorage), // sessionStorage: cleared on tab close
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
