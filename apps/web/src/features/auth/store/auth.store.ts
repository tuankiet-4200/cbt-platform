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
  clearAuth: () => void;
  logout: () => void;
}

export const AUTH_LOGOUT_EVENT_KEY = 'cbt-auth-logout';
export const AUTH_LOGOUT_SUPPRESS_KEY = 'cbt-auth-logout-suppress';

const clearSession = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) =>
        {
          window.localStorage.removeItem(AUTH_LOGOUT_SUPPRESS_KEY);
          set({ user, accessToken, isAuthenticated: true });
        },

      setAccessToken: (accessToken) =>
        set({ accessToken }),

      clearAuth: () =>
        set(clearSession),

      logout: () => {
        set(clearSession);
        window.localStorage.setItem(AUTH_LOGOUT_SUPPRESS_KEY, '1');
        window.localStorage.setItem(AUTH_LOGOUT_EVENT_KEY, String(Date.now()));
      },
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
