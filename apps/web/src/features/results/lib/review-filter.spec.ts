import { describe, expect, it } from 'vitest';
import { getReviewRequest, matchesReviewFilter } from './review-filter';

describe('result review filtering', () => {
  it('loads the complete section whenever a filter is active', () => {
    expect(getReviewRequest('MATH', 'WRONG', 4)).toEqual({
      isFiltering: true,
      page: 1,
      limit: 100,
    });
    expect(getReviewRequest('READING', 'ALL', 3)).toEqual({
      isFiltering: false,
      page: 3,
      limit: 1,
    });
  });

  it('distinguishes wrong, skipped, correct and flagged answers', () => {
    const flagged = new Set(['question-1']);
    const wrong = {
      id: 'question-1',
      userAnswer: { selectedOptionId: 'B' },
      isCorrect: false,
    };
    const skipped = {
      id: 'question-2',
      userAnswer: null,
      isCorrect: null,
    };

    expect(matchesReviewFilter(wrong, 'WRONG', flagged)).toBe(true);
    expect(matchesReviewFilter(wrong, 'FLAGGED', flagged)).toBe(true);
    expect(matchesReviewFilter(skipped, 'SKIPPED', flagged)).toBe(true);
    expect(matchesReviewFilter(skipped, 'WRONG', flagged)).toBe(false);
  });
});
