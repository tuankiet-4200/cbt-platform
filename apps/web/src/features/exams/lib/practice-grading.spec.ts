import { describe, expect, it } from 'vitest';
import type { SessionQuestion } from '@/features/exam/api/sessions.api';
import { gradePracticeAnswer, isPracticeAnswerComplete } from './practice-grading';

function question(type: string, payload: Record<string, unknown>): SessionQuestion {
  return {
    id: 'question-1',
    type,
    expectedTimeSecs: 90,
    points: 1,
    content: { stem: [], type, payload, _version: 2 },
  };
}

describe('practice grading', () => {
  it('grades single and multiple choice answers exactly', () => {
    const single = question('SINGLE_CHOICE', {
      options: [{ id: 'A' }, { id: 'B', isCorrect: true }],
    });
    const multiple = question('MULTIPLE_CHOICE', {
      options: [
        { id: 'A', isCorrect: true },
        { id: 'B' },
        { id: 'C', isCorrect: true },
      ],
    });

    expect(gradePracticeAnswer(single, { selectedOptionId: 'B' })).toBe(true);
    expect(gradePracticeAnswer(single, { selectedOptionId: 'A' })).toBe(false);
    expect(gradePracticeAnswer(multiple, { selectedOptionIds: ['C', 'A'] })).toBe(true);
    expect(gradePracticeAnswer(multiple, { selectedOptionIds: ['A'] })).toBe(false);
  });

  it('requires every true/false statement to match', () => {
    const target = question('TRUE_FALSE_MATRIX', {
      statements: [
        { id: 'S1', isTrue: true },
        { id: 'S2', isTrue: false },
      ],
    });

    expect(gradePracticeAnswer(target, {
      answers: [
        { statementId: 'S1', value: true },
        { statementId: 'S2', value: false },
      ],
    })).toBe(true);
    expect(isPracticeAnswerComplete(target, {
      answers: [{ statementId: 'S1', value: true }],
    })).toBe(false);
  });

  it('requires every drag-drop position to match', () => {
    const target = question('DRAG_DROP', {
      slots: [
        { id: 'slot1', correctItemId: 'I2' },
        { id: 'slot2', correctItemId: 'I1' },
      ],
    });

    expect(gradePracticeAnswer(target, {
      slots: [
        { slotId: 'slot1', itemId: 'I2' },
        { slotId: 'slot2', itemId: 'I1' },
      ],
    })).toBe(true);
    expect(gradePracticeAnswer(target, {
      slots: [
        { slotId: 'slot1', itemId: 'I1' },
        { slotId: 'slot2', itemId: 'I2' },
      ],
    })).toBe(false);
  });

  it('uses the exact comma-decimal rule for fill number', () => {
    const target = question('FILL_NUMBER', {
      blanks: [{ id: 'B1', correctValue: '0,64' }],
    });

    expect(gradePracticeAnswer(target, {
      blanks: [{ blankId: 'B1', value: '0,64' }],
    })).toBe(true);
    expect(gradePracticeAnswer(target, {
      blanks: [{ blankId: 'B1', value: '0.64' }],
    })).toBe(false);
    expect(gradePracticeAnswer(target, {
      blanks: [{ blankId: 'B1', value: '0,640' }],
    })).toBe(false);
  });

  it('normalizes whitespace and Vietnamese case for fill text', () => {
    const target = question('FILL_TEXT', {
      blanks: [{ id: 'B1', correctValue: 'Lòng yêu thương' }],
    });

    expect(gradePracticeAnswer(target, {
      blanks: [{ blankId: 'B1', value: '  LÒNG   YÊU THƯƠNG ' }],
    })).toBe(true);
  });

  it('does not allow checking an unfinished fill answer', () => {
    const target = question('FILL_TEXT', {
      blanks: [
        { id: 'B1', correctValue: 'A' },
        { id: 'B2', correctValue: 'B' },
      ],
    });

    expect(isPracticeAnswerComplete(target, {
      blanks: [
        { blankId: 'B1', value: 'A' },
        { blankId: 'B2', value: ' ' },
      ],
    })).toBe(false);
    expect(isPracticeAnswerComplete(target, {
      blanks: [
        { blankId: 'B1', value: 'A' },
        { blankId: 'B2', value: 'B' },
      ],
    })).toBe(true);
  });
});
