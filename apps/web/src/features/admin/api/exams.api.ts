import apiClient from '@/lib/api-client';
import type { CognitiveLevel, ExamSectionType, QuestionType } from './questionBank.api';

export type ExamAccessType = 'PUBLIC' | 'LOCKED';

export interface TagRule {
  tagSlug?: string;
  tagId?: string;
  count?: number;
}

export interface ChildTagRule {
  tagSlug?: string;
  tagId?: string;
  min?: number;
  max?: number;
}

export interface DifficultyRule {
  level: CognitiveLevel;
  count?: number;
  percent?: number;
  min?: number;
  max?: number;
}

export interface QuestionTypeRule {
  type: QuestionType;
  count?: number;
  percent?: number;
  min?: number;
  max?: number;
}

export interface SectionBlueprint {
  sectionType: ExamSectionType;
  targetQuestionCount?: number;
  targetBundleCount?: number;
  rootTagRules?: TagRule[];
  childTagRules?: ChildTagRule[];
  difficultyRules?: DifficultyRule[];
  questionTypeRules?: QuestionTypeRule[];
}

export interface ExamBlueprint {
  version: 1;
  durationMins?: number;
  randomization?: {
    seed?: string;
    maxAttempts?: number;
  };
  sections: SectionBlueprint[];
}

export interface AdminExam {
  id: string;
  title: string;
  description?: string | null;
  durationMins: number;
  totalPoints: number;
  accessType: ExamAccessType;
  isPublished: boolean;
  blueprintJson?: ExamBlueprint | null;
  generationSeed?: string | null;
  generatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  counts: {
    mathQuestions: number;
    readingBundles: number;
    readingQuestions: number;
    scienceBundles: number;
    scienceQuestions: number;
    sessions: number;
    accessCodes: number;
  };
}

export interface Shortage {
  section: ExamSectionType;
  constraint: string;
  required: number;
  available: number;
  unit: string;
}

export interface AvailabilityReport {
  ok: boolean;
  shortages: Shortage[];
  candidateCounts: Record<ExamSectionType, number>;
}

export interface ExamPreview {
  id: string;
  title: string;
  durationMins: number;
  accessType: ExamAccessType;
  isPublished: boolean;
  totalPoints: number;
  generationSeed?: string | null;
  generatedAt?: string | null;
  blueprintJson?: ExamBlueprint | null;
  sections: {
    MATH: {
      questionCount: number;
      itemCount: number;
      difficulty: Record<CognitiveLevel, number>;
      items?: ExamPreviewQuestion[];
    };
    READING: {
      bundleCount: number;
      questionCount: number;
      itemCount: number;
      difficulty: Record<CognitiveLevel, number>;
      bundles?: ExamPreviewBundle[];
    };
    SCIENCE: {
      bundleCount: number;
      questionCount: number;
      itemCount: number;
      difficulty: Record<CognitiveLevel, number>;
      bundles?: ExamPreviewBundle[];
    };
  };
}

export interface ExamPreviewTag {
  id: string;
  name: string;
  slug: string;
}

export interface ExamPreviewQuestion {
  id: string;
  order: number;
  points?: number;
  type: QuestionType;
  level: CognitiveLevel;
  tags?: ExamPreviewTag[];
  snippet: string;
}

export interface ExamPreviewBundle {
  id: string;
  order: number;
  title?: string | null;
  tags: ExamPreviewTag[];
  snippet: string;
  questions: ExamPreviewQuestion[];
}

export interface GenerateResponse {
  ok: boolean;
  seed: string;
  preview?: ExamPreview;
  shortages?: Shortage[];
}

interface ApiEnvelope<T> {
  data: T;
}

export async function listExams() {
  const response = await apiClient.get<ApiEnvelope<AdminExam[]>>('/admin/exams');
  return response.data.data;
}

export async function createExam(payload: {
  title: string;
  description?: string;
  instructions?: string;
  durationMins?: number;
  accessType?: ExamAccessType;
  blueprintJson?: ExamBlueprint;
}) {
  const response = await apiClient.post<ApiEnvelope<AdminExam>>('/admin/exams', payload);
  return response.data.data;
}

export async function updateExamSettings(id: string, payload: {
  title?: string;
  description?: string;
  accessType?: ExamAccessType;
}) {
  const response = await apiClient.patch<ApiEnvelope<AdminExam>>(`/admin/exams/${id}`, payload);
  return response.data.data;
}

export async function updateExamBlueprint(id: string, blueprintJson: ExamBlueprint) {
  const response = await apiClient.patch<ApiEnvelope<AdminExam>>(`/admin/exams/${id}/blueprint`, { blueprintJson });
  return response.data.data;
}

export async function checkBlueprintAvailability(blueprintJson: ExamBlueprint) {
  const response = await apiClient.post<ApiEnvelope<AvailabilityReport>>('/admin/exams/blueprint/availability', { blueprintJson });
  return response.data.data;
}

export async function checkExamAvailability(id: string) {
  const response = await apiClient.get<ApiEnvelope<AvailabilityReport>>(`/admin/exams/${id}/availability`);
  return response.data.data;
}

export async function generateExamDraft(id: string, payload: { seed?: string; maxAttempts?: number }) {
  const response = await apiClient.post<ApiEnvelope<GenerateResponse>>(`/admin/exams/${id}/generate`, payload);
  return response.data.data;
}

export async function regenerateExamDraft(id: string, payload: { seed?: string; maxAttempts?: number }) {
  const response = await apiClient.post<ApiEnvelope<GenerateResponse>>(`/admin/exams/${id}/regenerate`, payload);
  return response.data.data;
}

export async function previewExam(id: string) {
  const response = await apiClient.get<ApiEnvelope<ExamPreview>>(`/admin/exams/${id}/preview`);
  return response.data.data;
}

export async function publishExam(id: string, isPublished: boolean) {
  const response = await apiClient.patch<ApiEnvelope<AdminExam>>(`/admin/exams/${id}/publish`, { isPublished });
  return response.data.data;
}
