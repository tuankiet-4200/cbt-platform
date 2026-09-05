import apiClient from '@/lib/api-client';
import type {
  ExamSectionType,
  SessionBundle,
  SessionQuestion,
} from '@/features/exam/api/sessions.api';

export type UserExamAccessType = 'PUBLIC' | 'LOCKED';
export type UserExamAccessSource = 'PUBLIC' | 'ACCESS_CODE' | 'GRANTED';
export type UserExamSessionStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'ABANDONED';

export interface UserExam {
  id: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
  durationMins: number;
  contentFontSize: number;
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
    selectedSections: Array<'MATH' | 'READING' | 'SCIENCE'>;
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

export interface PracticeTag {
  id: string;
  name: string;
  slug: string;
  sectionType: ExamSectionType;
  parentId: string | null;
  depth: number;
  questionCount: number;
}

export interface PracticeSection {
  sectionType: ExamSectionType;
  layout: 'SINGLE_COLUMN' | 'TWO_COLUMN';
  questions: SessionQuestion[];
  bundles: SessionBundle[];
}

export interface PracticeContent {
  source: 'EXAM' | 'TAG';
  id: string;
  title: string;
  description?: string | null;
  contentFontSize: number;
  sections: PracticeSection[];
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

export async function getExamPractice(id: string) {
  const response = await apiClient.get<ApiEnvelope<PracticeContent>>(
    `/exams/${id}/practice`,
  );
  return response.data.data;
}

export async function listPracticeTags() {
  const response = await apiClient.get<ApiEnvelope<PracticeTag[]>>(
    '/exams/practice/tags',
  );
  return response.data.data;
}

export async function getTagPractice(tagId: string) {
  const response = await apiClient.get<ApiEnvelope<PracticeContent>>(
    `/exams/practice/tags/${tagId}`,
  );
  return response.data.data;
}

export async function unlockExam(code: string) {
  const response = await apiClient.post<ApiEnvelope<UnlockExamResult>>('/exams/unlock', { code });
  return response.data.data;
}
