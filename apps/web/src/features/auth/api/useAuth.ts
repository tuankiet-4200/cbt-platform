import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { login, logout, refreshSession, register, type LoginPayload, type RegisterPayload } from './auth.api';
import { AUTH_LOGOUT_EVENT_KEY, AUTH_LOGOUT_SUPPRESS_KEY, useAuthStore } from '../store/auth.store';

export function useLoginMutation() {
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (session) => {
      setAuth(session.user, session.accessToken);
      queryClient.invalidateQueries();
    },
  });
}

export function useRegisterMutation() {
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: (payload: RegisterPayload) => register(payload),
    onSuccess: (session) => {
      setAuth(session.user, session.accessToken);
      queryClient.invalidateQueries();
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const logoutClient = useAuthStore((state) => state.logout);

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      logoutClient();
      queryClient.clear();
    },
  });
}

export function useAuthBootstrap(enabled = true) {
  const { isAuthenticated, setAuth, clearAuth } = useAuthStore();
  const [isBootstrapping, setIsBootstrapping] = useState(enabled && !isAuthenticated);

  const bootstrap = useCallback(async () => {
    if (!enabled || isAuthenticated) {
      setIsBootstrapping(false);
      return;
    }

    if (window.localStorage.getItem(AUTH_LOGOUT_SUPPRESS_KEY) === '1') {
      clearAuth();
      setIsBootstrapping(false);
      return;
    }

    setIsBootstrapping(true);
    try {
      const session = await refreshWithConcurrencyRetry();
      setAuth(session.user, session.accessToken);
    } catch {
      clearAuth();
    } finally {
      setIsBootstrapping(false);
    }
  }, [clearAuth, enabled, isAuthenticated, setAuth]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return { isBootstrapping };
}

export function useAuthLogoutSync() {
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_LOGOUT_EVENT_KEY) return;
      clearAuth();
      queryClient.clear();
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [clearAuth, queryClient]);
}

async function refreshWithConcurrencyRetry() {
  try {
    return await refreshSession();
  } catch (error) {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    try {
      return await refreshSession();
    } catch {
      throw error;
    }
  }
}
