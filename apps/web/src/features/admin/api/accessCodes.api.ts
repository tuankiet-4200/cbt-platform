import apiClient from '@/lib/api-client';
import type { ExamAccessType } from './exams.api';

export type AccessCodeStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'EXHAUSTED';

export interface AdminAccessCode {
  id: string;
  code: string;
  examId: string;
  exam: {
    id: string;
    title: string;
    accessType: ExamAccessType;
    isPublished: boolean;
    durationMins: number;
  };
  maxUses?: number | null;
  usedCount: number;
  expiresAt?: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy?: {
    id: string;
    displayName: string;
    email: string;
  };
  counts?: {
    accesses: number;
  };
  status?: AccessCodeStatus;
}

interface ApiEnvelope<T> {
  data: T;
}

export async function listAccessCodes() {
  const response = await apiClient.get<ApiEnvelope<AdminAccessCode[]>>('/admin/access-codes');
  return response.data.data;
}

export async function createAccessCode(payload: {
  examId: string;
  maxUses?: number;
  expiresAt?: string;
}) {
  const response = await apiClient.post<ApiEnvelope<AdminAccessCode>>('/admin/access-codes', payload);
  return response.data.data;
}

export async function deactivateAccessCode(id: string) {
  const response = await apiClient.patch<ApiEnvelope<AdminAccessCode>>(`/admin/access-codes/${id}/deactivate`);
  return response.data.data;
}
