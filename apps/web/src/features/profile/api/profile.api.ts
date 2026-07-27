import apiClient from '@/lib/api-client';
import type { AuthUser } from '@/features/auth/store/auth.store';

interface Envelope<T> {
  data: T;
}

export interface UserProfile extends AuthUser {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    examAttempts: number;
    examAccesses: number;
    contributions: number;
  };
}

export async function getMyProfile() {
  const response = await apiClient.get<Envelope<UserProfile>>('/users/me');
  return response.data.data;
}

export async function updateMyProfile(displayName: string) {
  const response = await apiClient.patch<Envelope<AuthUser>>('/users/me', {
    displayName,
  });
  return response.data.data;
}

export async function changeMyPassword(payload: {
  currentPassword: string;
  newPassword: string;
}) {
  const response = await apiClient.patch<
    Envelope<{ ok: boolean; requiresLogin: boolean }>
  >('/users/me/password', payload);
  return response.data.data;
}
