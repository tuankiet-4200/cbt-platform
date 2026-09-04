import type { ExamSectionType } from '@/features/exam/api/sessions.api';

export type ReviewFilter =
  | 'ALL'
  | 'WRONG'
  | 'FLAGGED'
  | 'SKIPPED'
  | 'CORRECT';

export function getReviewNavigatorTone(isCorrect: boolean | null) {
  return isCorrect === true ? 'correct' : 'incorrect';
}

export function getReviewRequest(
  section: ExamSectionType,
  filter: ReviewFilter,
  page: number,
) {
  const isFiltering = filter !== 'ALL';
  return {
    isFiltering,
    page: isFiltering ? 1 : page,
    limit: isFiltering ? 100 : section === 'MATH' ? 10 : 1,
  };
}

export function matchesReviewFilter(
  question: {
    id: string;
    userAnswer: Record<string, unknown> | null;
    isCorrect: boolean | null;
  },
  filter: ReviewFilter,
  flaggedQuestionIds: Set<string>,
) {
  if (filter === 'ALL') return true;
  if (filter === 'FLAGGED') return flaggedQuestionIds.has(question.id);
  if (filter === 'SKIPPED') return question.userAnswer === null;
  if (filter === 'CORRECT') return question.isCorrect === true;
  return question.userAnswer !== null && question.isCorrect === false;
}
