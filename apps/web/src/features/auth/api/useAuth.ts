import { useMutation, useQueryClient } from '@tanstack/react-query';
import { login, logout, register, type LoginPayload, type RegisterPayload } from './auth.api';
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

