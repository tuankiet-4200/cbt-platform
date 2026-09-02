import { describe, expect, it } from 'vitest';
import {
  getAvailableExamSections,
  getSectionsDurationMins,
} from './exam-sections';

describe('exam section scope helpers', () => {
  it('keeps sections in canonical order and omits empty sections', () => {
    expect(getAvailableExamSections({
      mathQuestions: 0,
      readingQuestions: 20,
      scienceQuestions: 15,
    })).toEqual(['READING', 'SCIENCE']);
  });

  it('uses the fixed duration for full and single-section attempts', () => {
    expect(getSectionsDurationMins(['MATH', 'READING', 'SCIENCE'])).toBe(150);
    expect(getSectionsDurationMins(['MATH'])).toBe(60);
    expect(getSectionsDurationMins(['READING'])).toBe(30);
    expect(getSectionsDurationMins(['SCIENCE'])).toBe(60);
  });
});
