import apiClient from '@/lib/api-client';
import type { SectionScore } from '@/features/results/api/results.api';

interface ApiEnvelope<T> {
  data: T;
}

export interface ExamHistoryEntry {
  id: string;
  attemptNumber: number;
  startedAt: string;
  completedAt?: string | null;
  result: {
    totalScore: number;
    maxScore: number;
    percentScore: number;
    correctCount: number;
    wrongCount: number;
    skippedCount: number;
    durationSecs: number;
    sectionScores: SectionScore[];
    completedAt: string;
  };
}

export interface ExamHistory {
  exam: { id: string; title: string };
  data: ExamHistoryEntry[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  percentScore: number;
  isCurrentUser: boolean;
}

export interface Leaderboard {
  exam: { id: string; title: string };
  entries: LeaderboardEntry[];
  currentUser: LeaderboardEntry | null;
}

export async function getExamHistory(examId: string, page = 1) {
  const response = await apiClient.get<ExamHistory>(
    `/analytics/me/exams/${examId}`,
    { params: { page, limit: 10 } },
  );
  return response.data;
}

export async function getLeaderboard(examId: string) {
  const response = await apiClient.get<ApiEnvelope<Leaderboard>>(
    `/exams/${examId}/leaderboard`,
  );
  return response.data.data;
}
