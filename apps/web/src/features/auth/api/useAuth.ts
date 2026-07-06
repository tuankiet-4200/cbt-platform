import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { login, logout, refreshSession, register, type LoginPayload, type RegisterPayload } from './auth.api';
import { useAuthStore } from '../store/auth.store';

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
  const clearAuth = useAuthStore((state) => state.logout);

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      clearAuth();
      queryClient.clear();
    },
  });
}

export function useAuthBootstrap(enabled = true) {
  const { isAuthenticated, setAuth, logout: clearAuth } = useAuthStore();
  const [isBootstrapping, setIsBootstrapping] = useState(enabled && !isAuthenticated);

  const bootstrap = useCallback(async () => {
    if (!enabled || isAuthenticated) {
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
