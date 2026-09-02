import { describe, expect, it } from 'vitest';
import { orderQuestionOptions } from './question-order';

const options = ['A', 'B', 'C', 'D', 'E'].map((id) => ({ id }));

describe('orderQuestionOptions', () => {
  it('keeps original order unless shuffle is requested', () => {
    expect(
      orderQuestionOptions(options, 'original', 'attempt-1', 'question-1'),
    ).toEqual(options);
  });

  it('produces a stable per-attempt shuffle without mutating source options', () => {
    const first = orderQuestionOptions(
      options,
      'shuffle',
      'attempt-1',
      'question-1',
    );
    const repeated = orderQuestionOptions(
      options,
      'shuffle',
      'attempt-1',
      'question-1',
    );
    const anotherAttempt = orderQuestionOptions(
      options,
      'shuffle',
      'attempt-2',
      'question-1',
    );

    expect(first).toEqual(repeated);
    expect(first).not.toEqual(anotherAttempt);
    expect(options.map((option) => option.id)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
    ]);
  });
});
