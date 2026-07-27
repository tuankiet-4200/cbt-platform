import apiClient from '@/lib/api-client';

export type UserExamAccessType = 'PUBLIC' | 'LOCKED';
export type UserExamAccessSource = 'PUBLIC' | 'ACCESS_CODE' | 'GRANTED';
export type UserExamSessionStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'ABANDONED';

export interface UserExam {
  id: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
  durationMins: number;
  totalPoints: number;
  accessType: UserExamAccessType;
  access: {
    source: UserExamAccessSource;
    grantedAt?: string | null;
  };
  counts: {
    mathQuestions: number;
    readingBundles: number;
    readingQuestions: number;
    scienceBundles: number;
    scienceQuestions: number;
    totalQuestions: number;
  };
  latestSession?: {
    id: string;
    status: UserExamSessionStatus;
    startTime: string;
    endTime: string;
    submittedAt?: string | null;
  } | null;
  latestAttempt?: {
    id: string;
    status: UserExamSessionStatus;
    currentSection: 'MATH' | 'READING' | 'SCIENCE' | null;
    startedAt: string;
    completedAt?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface UnlockExamResult {
  ok: boolean;
  alreadyUnlocked: boolean;
  exam: {
    id: string;
    title: string;
    accessType: UserExamAccessType;
    isPublished: boolean;
    durationMins: number;
  };
  grantedAt: string;
}

interface ApiEnvelope<T> {
  data: T;
}

export async function listAvailableExams() {
  const response = await apiClient.get<ApiEnvelope<UserExam[]>>('/exams');
  return response.data.data;
}

export async function getAvailableExam(id: string) {
  const response = await apiClient.get<ApiEnvelope<UserExam>>(`/exams/${id}`);
  return response.data.data;
}

export async function unlockExam(code: string) {
  const response = await apiClient.post<ApiEnvelope<UnlockExamResult>>('/exams/unlock', { code });
  return response.data.data;
}
