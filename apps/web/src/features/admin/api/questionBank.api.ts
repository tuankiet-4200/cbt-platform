import apiClient from '@/lib/api-client';

export type QuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE_MATRIX'
  | 'DRAG_DROP'
  | 'FILL_NUMBER';

export type QuestionStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
export type CognitiveLevel = 'RECOGNITION' | 'COMPREHENSION' | 'APPLICATION' | 'HIGH_APPLICATION';

export interface RichTextNode {
  type: 'text' | 'latex' | 'latex_block' | 'image' | 'bold' | 'italic' | 'break' | 'blank';
  content?: string;
  url?: string;
  alt?: string;
  width?: number;
  blankId?: string;
}

export interface QuestionContent {
  stem: RichTextNode[];
  type: QuestionType;
  payload: Record<string, unknown>;
  solution?: RichTextNode[];
  _version: 2;
}

export interface TagNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  depth: number;
  orderIndex: number;
  children: TagNode[];
}

export interface AdminQuestion {
  id: string;
  type: QuestionType;
  status: QuestionStatus;
  level: CognitiveLevel;
  contentJson: QuestionContent;
  irtParams: { a: number; b: number; c: number };
  expectedTimeSecs: number;
  reviewNote?: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; email: string; displayName: string };
  reviewedBy?: { id: string; email: string; displayName: string } | null;
  tags: Array<{ tag: TagNode }>;
  bundleQuestion?: { bundleId: string; questionId: string; orderInBundle: number; points: number } | null;
}

export type ExamSectionType = 'MATH' | 'READING' | 'SCIENCE';

export interface PassageBundle {
  id: string;
  sectionType: Exclude<ExamSectionType, 'MATH'>;
  title: string;
  contentJson: RichTextNode[];
  expectedTimeSecs: number;
  status: QuestionStatus;
  createdAt: string;
  updatedAt: string;
  questions: Array<{
    questionId: string;
    orderInBundle: number;
    points: number;
    question: AdminQuestion;
  }>;
  tags: Array<{ tag: TagNode }>;
  author: { id: string; email: string; displayName: string };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ListQuestionsParams {
  page?: number;
  limit?: number;
  type?: QuestionType;
  level?: CognitiveLevel;
  status?: QuestionStatus;
  tagId?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  standaloneOnly?: boolean;
}

export interface CreateQuestionPayload {
  type: QuestionType;
  status?: QuestionStatus;
  level?: CognitiveLevel;
  contentJson: QuestionContent;
  irtParams?: { a: number; b: number; c: number };
  expectedTimeSecs?: number;
  tagIds?: string[];
}

export type UpdateQuestionPayload = Partial<CreateQuestionPayload> & {
  reviewNote?: string;
};

export interface CreatePassageBundlePayload {
  sectionType: Exclude<ExamSectionType, 'MATH'>;
  title: string;
  contentJson: RichTextNode[];
  expectedTimeSecs?: number;
  status?: QuestionStatus;
  tagIds?: string[];
  questions: Array<{ questionId: string; orderInBundle: number; points?: number }>;
}

export interface CreatePassageBundleWithQuestionsPayload extends Omit<CreatePassageBundlePayload, 'questions'> {
  questions: Array<CreateQuestionPayload & { points?: number }>;
}

export type UpdatePassageBundlePayload = Partial<CreatePassageBundlePayload>;

interface ApiEnvelope<T> {
  data: T;
  meta?: PaginationMeta;
}

export async function listQuestions(params: ListQuestionsParams) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return;
    if (key === 'tagId' && Array.isArray(value)) {
      value.forEach((tagId) => searchParams.append('tagId[]', tagId));
      return;
    }
    searchParams.set(key, String(value));
  });

  const response = await apiClient.get<ApiEnvelope<AdminQuestion[]>>('/admin/questions', {
    params: searchParams,
  });
  return response.data;
}

export async function listTags() {
  const response = await apiClient.get<ApiEnvelope<TagNode[]>>('/admin/tags');
  return response.data.data;
}

export async function createQuestion(payload: CreateQuestionPayload) {
  const response = await apiClient.post<ApiEnvelope<AdminQuestion>>('/admin/questions', payload);
  return response.data.data;
}

export async function getQuestion(id: string) {
  const response = await apiClient.get<ApiEnvelope<AdminQuestion>>(`/admin/questions/${id}`);
  return response.data.data;
}

export async function updateQuestion(id: string, payload: UpdateQuestionPayload) {
  const response = await apiClient.patch<ApiEnvelope<AdminQuestion>>(`/admin/questions/${id}`, payload);
  return response.data.data;
}

export async function bulkCreateQuestions(questions: CreateQuestionPayload[]) {
  const response = await apiClient.post<ApiEnvelope<{ createdCount: number; data: AdminQuestion[] }>>('/admin/questions/bulk', {
    questions,
  });
  return response.data.data;
}

export async function updateQuestionStatus(
  id: string,
  payload: { status: QuestionStatus; reviewNote?: string },
) {
  const response = await apiClient.patch<ApiEnvelope<AdminQuestion>>(`/admin/questions/${id}/status`, payload);
  return response.data.data;
}

export async function bulkUpdateQuestionStatus(
  ids: string[],
  payload: { status: QuestionStatus; reviewNote?: string },
) {
  const response = await apiClient.patch<ApiEnvelope<{ updatedCount: number; data: AdminQuestion[] }>>('/admin/questions/bulk/status', {
    ids,
    ...payload,
  });
  return response.data.data;
}

export async function listPassageBundles(params: {
  page?: number;
  limit?: number;
  sectionType?: Exclude<ExamSectionType, 'MATH'> | '';
  status?: QuestionStatus | '';
}) {
  const response = await apiClient.get<ApiEnvelope<PassageBundle[]>>('/admin/passage-bundles', { params });
  return response.data;
}

export async function createPassageBundle(payload: CreatePassageBundlePayload) {
  const response = await apiClient.post<ApiEnvelope<PassageBundle>>('/admin/passage-bundles', payload);
  return response.data.data;
}

export async function createPassageBundleWithQuestions(payload: CreatePassageBundleWithQuestionsPayload) {
  const response = await apiClient.post<ApiEnvelope<PassageBundle>>('/admin/passage-bundles/with-questions', payload);
  return response.data.data;
}

export async function getPassageBundle(id: string) {
  const response = await apiClient.get<ApiEnvelope<PassageBundle>>(`/admin/passage-bundles/${id}`);
  return response.data.data;
}

export async function updatePassageBundle(id: string, payload: UpdatePassageBundlePayload) {
  const response = await apiClient.patch<ApiEnvelope<PassageBundle>>(`/admin/passage-bundles/${id}`, payload);
  return response.data.data;
}
