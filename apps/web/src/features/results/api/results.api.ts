import apiClient from '@/lib/api-client';
import type {
  ExamSectionType,
  RichTextNode,
} from '@/features/exam/api/sessions.api';

export interface SectionScore {
  section: ExamSectionType;
  score: number;
  maxScore: number;
  correct: number;
  total: number;
}

export interface ExamResult {
  id: string;
  attemptId: string;
  exam: {
    id: string;
    title: string;
    totalPoints: number;
  };
  totalScore: number;
  maxScore: number;
  percentScore: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  durationSecs: number;
  sectionScores: SectionScore[];
  tagBreakdown: Array<{
    tagId: string;
    tagName: string;
    correct: number;
    total: number;
  }>;
  completedAt: string;
  startedAt: string;
  attemptCompletedAt?: string | null;
}

export interface ReviewQuestion {
  id: string;
  type: string;
  order: number;
  points: number;
  expectedTimeSecs: number;
  content: {
    stem: RichTextNode[];
    payload: Record<string, unknown>;
    solution?: RichTextNode[];
  };
  userAnswer: Record<string, unknown> | null;
  correctAnswer: Record<string, unknown>;
  isCorrect: boolean | null;
  pointsEarned: number;
  timeSpentMs: number;
  tags: Array<{ id: string; name: string }>;
}

export interface ReviewBundle {
  id: string;
  title?: string | null;
  content: RichTextNode[];
  order: number;
  questions: ReviewQuestion[];
}

export interface AnswerReview {
  attemptId: string;
  exam: {
    id: string;
    title: string;
    totalPoints: number;
  };
  section: ExamSectionType;
  questions: ReviewQuestion[];
  bundles: ReviewBundle[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    unit: 'QUESTION' | 'BUNDLE';
  };
}

interface ApiEnvelope<T> {
  data: T;
}

export async function getExamResult(attemptId: string) {
  const response = await apiClient.get<ApiEnvelope<ExamResult>>(
    `/results/${attemptId}`,
  );
  return response.data.data;
}

export async function getAnswerReview(
  attemptId: string,
  section: ExamSectionType,
  page: number,
  limit: number,
) {
  const response = await apiClient.get<ApiEnvelope<AnswerReview>>(
    `/results/${attemptId}/answers`,
    { params: { section, page, limit } },
  );
  return response.data.data;
}
