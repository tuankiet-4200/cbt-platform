import apiClient from '@/lib/api-client';

export type UserRole = 'ADMIN' | 'USER';

export interface ManagedUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    examAttempts: number;
    examAccesses: number;
    contributions: number;
  };
}

export interface AdminUsersResponse {
  data: ManagedUser[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    active: number;
    admins: number;
  };
}

export async function listUsers(params: {
  page: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
}) {
  const response = await apiClient.get<AdminUsersResponse>('/admin/users', {
    params: { ...params, limit: 20 },
  });
  return response.data;
}

export async function updateUserStatus(id: string, isActive: boolean) {
  const response = await apiClient.patch<{ data: ManagedUser }>(
    `/admin/users/${id}/status`,
    { isActive },
  );
  return response.data.data;
}

export async function updateUserRole(id: string, role: UserRole) {
  const response = await apiClient.patch<{ data: ManagedUser }>(
    `/admin/users/${id}/role`,
    { role },
  );
  return response.data.data;
}
