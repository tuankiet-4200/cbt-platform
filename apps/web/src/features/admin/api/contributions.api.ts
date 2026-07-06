import apiClient from '@/lib/api-client';
import type { PaginationMeta } from './questionBank.api';

export type ContributionStatus = 'PENDING' | 'REVIEWING' | 'APPROVED' | 'REJECTED';

export interface ContributionSubmission {
  id: string;
  title: string;
  description?: string | null;
  fileUrl: string;
  fileType: string;
  status: ContributionStatus;
  adminNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  submitter: { id: string; email: string; displayName: string };
  reviewedBy?: { id: string; email: string; displayName: string } | null;
}

interface ApiEnvelope<T> {
  data: T;
  meta?: PaginationMeta;
}

export async function listContributions(params: { page?: number; limit?: number; status?: ContributionStatus | '' }) {
  const response = await apiClient.get<ApiEnvelope<ContributionSubmission[]>>('/admin/contributions', { params });
  return response.data;
}

export async function updateContributionStatus(
  id: string,
  payload: { status: Exclude<ContributionStatus, 'PENDING'>; adminNote?: string },
) {
  const response = await apiClient.patch<ApiEnvelope<ContributionSubmission>>(`/admin/contributions/${id}/status`, payload);
  return response.data.data;
}

export async function createContributionFileUrl(id: string) {
  const response = await apiClient.get<ApiEnvelope<{ signedUrl: string } | { url: string } | string>>(
    `/admin/contributions/${id}/file-url`,
  );
  return response.data.data;
}
