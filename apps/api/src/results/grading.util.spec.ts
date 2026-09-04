import { Prisma, QuestionType } from '@prisma/client';
import { gradeQuestion } from './grading.util';

describe('gradeQuestion', () => {
  it('grades SINGLE_CHOICE by exact option id', () => {
    const content = question('SINGLE_CHOICE', {
      options: [
        { id: 'A', isCorrect: false },
        { id: 'B', isCorrect: true },
      ],
    });
    expect(
      gradeQuestion(QuestionType.SINGLE_CHOICE, content, {
        selectedOptionId: 'B',
      }),
    ).toBe(true);
    expect(
      gradeQuestion(QuestionType.SINGLE_CHOICE, content, {
        selectedOptionId: 'A',
      }),
    ).toBe(false);
  });

  it('grades MULTIPLE_CHOICE all-or-nothing regardless of order', () => {
    const content = question('MULTIPLE_CHOICE', {
      options: [
        { id: 'A', isCorrect: true },
        { id: 'B', isCorrect: false },
        { id: 'C', isCorrect: true },
      ],
    });
    expect(
      gradeQuestion(QuestionType.MULTIPLE_CHOICE, content, {
        selectedOptionIds: ['C', 'A'],
      }),
    ).toBe(true);
    expect(
      gradeQuestion(QuestionType.MULTIPLE_CHOICE, content, {
        selectedOptionIds: ['A'],
      }),
    ).toBe(false);
  });

  it('grades TRUE_FALSE_MATRIX all-or-nothing', () => {
    const content = question('TRUE_FALSE_MATRIX', {
      statements: [
        { id: 'S1', isTrue: true },
        { id: 'S2', isTrue: false },
      ],
    });
    expect(
      gradeQuestion(QuestionType.TRUE_FALSE_MATRIX, content, {
        answers: [
          { statementId: 'S2', value: false },
          { statementId: 'S1', value: true },
        ],
      }),
    ).toBe(true);
    expect(
      gradeQuestion(QuestionType.TRUE_FALSE_MATRIX, content, {
        answers: [{ statementId: 'S1', value: true }],
      }),
    ).toBe(false);
  });

  it('grades DRAG_DROP all-or-nothing', () => {
    const content = question('DRAG_DROP', {
      slots: [
        { id: 'slot1', correctItemId: 'I2' },
        { id: 'slot2', correctItemId: 'I1' },
      ],
    });
    expect(
      gradeQuestion(QuestionType.DRAG_DROP, content, {
        slots: [
          { slotId: 'slot1', itemId: 'I2' },
          { slotId: 'slot2', itemId: 'I1' },
        ],
      }),
    ).toBe(true);
    expect(
      gradeQuestion(QuestionType.DRAG_DROP, content, {
        slots: [
          { slotId: 'slot1', itemId: 'I1' },
          { slotId: 'slot2', itemId: 'I2' },
        ],
      }),
    ).toBe(false);
  });

  it('grades every FILL_NUMBER blank by exact Vietnamese numeric text', () => {
    const content = question('FILL_NUMBER', {
      blanks: [
        { id: 'B1', correctValue: '3,14' },
        { id: 'B2', correctValue: '2' },
      ],
    });
    expect(
      gradeQuestion(QuestionType.FILL_NUMBER, content, {
        blanks: [
          { blankId: 'B1', value: '3,14' },
          { blankId: 'B2', value: '2' },
        ],
      }),
    ).toBe(true);

    for (const invalidValue of ['3.14', '3,140', '3,14abc']) {
      expect(
        gradeQuestion(QuestionType.FILL_NUMBER, content, {
          blanks: [
            { blankId: 'B1', value: invalidValue },
            { blankId: 'B2', value: '2' },
          ],
        }),
      ).toBe(false);
    }
  });

  it('keeps legacy numeric FILL_NUMBER keys compatible with decimal commas', () => {
    const content = question('FILL_NUMBER', {
      blanks: [{ id: 'B1', correctValue: 0.64 }],
    });

    expect(
      gradeQuestion(QuestionType.FILL_NUMBER, content, {
        blanks: [{ blankId: 'B1', value: '0,64' }],
      }),
    ).toBe(true);
    expect(
      gradeQuestion(QuestionType.FILL_NUMBER, content, {
        blanks: [{ blankId: 'B1', value: '0.64' }],
      }),
    ).toBe(false);
  });

  it('grades FILL_TEXT with normalized whitespace, Unicode, and optional casing', () => {
    const content = question('FILL_TEXT', {
      blanks: [
        { id: 'B1', correctValue: 'Nguyễn Du' },
        { id: 'B2', correctValue: 'Truyện Kiều', caseSensitive: true },
      ],
    });
    expect(
      gradeQuestion(QuestionType.FILL_TEXT, content, {
        blanks: [
          { blankId: 'B1', value: '  NGUYỄN   DU ' },
          { blankId: 'B2', value: 'Truyện Kiều' },
        ],
      }),
    ).toBe(true);
    expect(
      gradeQuestion(QuestionType.FILL_TEXT, content, {
        blanks: [
          { blankId: 'B1', value: 'Nguyễn Du' },
          { blankId: 'B2', value: 'truyện kiều' },
        ],
      }),
    ).toBe(false);
  });
});

function question(
  type: string,
  payload: Prisma.JsonObject,
): Prisma.JsonValue {
  return {
    stem: [],
    type,
    payload,
    _version: 2,
  };
}
