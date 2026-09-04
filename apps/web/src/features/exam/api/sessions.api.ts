import apiClient from '@/lib/api-client';

export type ExamSectionType = 'MATH' | 'READING' | 'SCIENCE';
export type SessionStatus =
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'GRADED'
  | 'ABANDONED';

export type RichTextNode =
  | { type: 'text' | 'latex' | 'latex_block' | 'bold' | 'italic'; content: string }
  | { type: 'image'; url: string; alt?: string; width?: number }
  | { type: 'break' }
  | { type: 'blank'; blankId: string };

export interface SafeQuestionContent {
  stem: RichTextNode[];
  type: string;
  payload: Record<string, unknown>;
  _version: number;
}

export interface SessionQuestion {
  id: string;
  type: string;
  content: SafeQuestionContent;
  expectedTimeSecs: number;
  points: number;
  orderInSection?: number;
  orderInBundle?: number;
}

export interface SessionBundle {
  id: string;
  title?: string | null;
  content: RichTextNode[];
  orderInSection: number;
  questions: SessionQuestion[];
}

export interface ExamAttempt {
  id: string;
  exam: {
    id: string;
    title: string;
    instructions?: string | null;
  };
  status: SessionStatus;
  currentSection: ExamSectionType | null;
  selectedSections: ExamSectionType[];
  startedAt: string;
  completedAt?: string | null;
  breakEndsAt?: string | null;
  sections: Array<{
    sectionType: ExamSectionType;
    durationMins: number;
    questionCount: number;
    session?: {
      id: string;
      status: SessionStatus;
      startTime: string;
      endTime: string;
      submittedAt?: string | null;
    } | null;
  }>;
}

export interface StartedSession {
  attemptId: string;
  sessionId: string;
  sectionType: ExamSectionType;
  status: SessionStatus;
  durationMins: number;
  startTime: string;
  endTime: string;
}

export interface SessionPayload {
  id: string;
  attemptId: string;
  status: SessionStatus;
  sectionType: ExamSectionType;
  durationMins: number;
  startTime: string;
  endTime: string;
  layout: 'SINGLE_COLUMN' | 'TWO_COLUMN';
  totalQuestions: number;
  exam: {
    id: string;
    title: string;
  };
  candidate: {
    id: string;
    displayName: string;
  };
  questions: SessionQuestion[];
  bundles: SessionBundle[];
}

export interface SessionState {
  sessionId: string;
  status: SessionStatus;
  endTime: string;
  answers: Record<string, Record<string, unknown>>;
  timing: Record<string, number>;
  currentIndex: number;
  source: 'REDIS_OR_RECOVERED' | 'EMPTY';
}

export interface SectionTransition {
  attemptId: string;
  completed: boolean;
  nextSection: ExamSectionType | null;
  submittedSection: ExamSectionType | null;
  answeredCount: number;
  breakEndsAt?: string | null;
}

export type ProctoringEventType =
  | 'TAB_SWITCH'
  | 'FULLSCREEN_EXIT'
  | 'COPY_ATTEMPT'
  | 'SESSION_BLUR';

export interface ProctoringEventInput {
  eventType: ProctoringEventType;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

interface ApiEnvelope<T> {
  data: T;
}

export async function createOrResumeAttempt(
  examId: string,
  sectionTypes?: ExamSectionType[],
) {
  const response = await apiClient.post<ApiEnvelope<ExamAttempt>>('/sessions', {
    examId,
    sectionTypes,
  });
  return response.data.data;
}

export async function getAttempt(attemptId: string) {
  const response = await apiClient.get<ApiEnvelope<ExamAttempt>>(
    `/sessions/attempts/${attemptId}`,
  );
  return response.data.data;
}

export async function startCurrentSection(attemptId: string) {
  const response = await apiClient.post<ApiEnvelope<StartedSession>>(
    `/sessions/attempts/${attemptId}/start`,
  );
  return response.data.data;
}

export async function getSessionPayload(sessionId: string) {
  const response = await apiClient.get<ApiEnvelope<SessionPayload>>(
    `/sessions/${sessionId}`,
  );
  return response.data.data;
}

export async function getSessionState(sessionId: string) {
  const response = await apiClient.get<ApiEnvelope<SessionState>>(
    `/sessions/${sessionId}/state`,
  );
  return response.data.data;
}

export async function syncSessionAnswers(
  sessionId: string,
  payload: {
    answers: Array<{
      questionId: string;
      answerJson: Record<string, unknown>;
      timeSpentMs: number;
    }>;
    currentIndex: number;
  },
  idempotencyKey: string,
) {
  const response = await apiClient.post<ApiEnvelope<{ ok: boolean }>>(
    `/sessions/${sessionId}/sync`,
    payload,
    { headers: { 'X-Idempotency-Key': idempotencyKey } },
  );
  return response.data.data;
}

export async function submitSection(sessionId: string) {
  const response = await apiClient.patch<ApiEnvelope<SectionTransition>>(
    `/sessions/${sessionId}/submit`,
  );
  return response.data.data;
}

export async function recordProctoringEvents(
  sessionId: string,
  events: ProctoringEventInput[],
) {
  const response = await apiClient.post<
    ApiEnvelope<{ ok: boolean; recorded: number }>
  >(`/sessions/${sessionId}/events`, { events });
  return response.data.data;
}
