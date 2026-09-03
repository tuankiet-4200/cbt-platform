import { BadRequestException } from '@nestjs/common';
import { QuestionType } from '@prisma/client';
import { normalizeRichTextArray, validateQuestionContent, validateRichTextArray } from './question-content.validator';

describe('question content validation', () => {
  it('accepts a complete multi-blank FILL_NUMBER payload', () => {
    expect(
      validateQuestionContent(
        {
          _version: 2,
          type: QuestionType.FILL_NUMBER,
          stem: [
            { type: 'text', content: 'a = ' },
            { type: 'blank', blankId: 'B1' },
            { type: 'text', content: ', b = ' },
            { type: 'blank', blankId: 'B2' },
          ],
          payload: {
            blanks: [
              {
                id: 'B1',
                correctValue: 2,
                displayFormat: 'integer',
                min: 0,
                max: 10,
              },
              {
                id: 'B2',
                correctValue: 1.5,
                displayFormat: 'decimal_comma',
              },
            ],
          },
        },
        QuestionType.FILL_NUMBER,
      ),
    ).toBeDefined();
  });

  it('rejects a stem blank without an exact payload match', () => {
    expect(() =>
      validateQuestionContent(
        {
          _version: 2,
          type: QuestionType.FILL_NUMBER,
          stem: [
            { type: 'blank', blankId: 'B1' },
            { type: 'blank', blankId: 'B2' },
          ],
          payload: {
            blanks: [{ id: 'B1', correctValue: 2 }],
          },
        },
        QuestionType.FILL_NUMBER,
      ),
    ).toThrow(
      new BadRequestException(
        'Every stem blankId must have exactly one matching payload blank',
      ),
    );
  });

  it('rejects an unsupported choice display order', () => {
    expect(() =>
      validateQuestionContent(
        {
          _version: 2,
          type: QuestionType.SINGLE_CHOICE,
          stem: [{ type: 'text', content: 'Chọn đáp án' }],
          payload: {
            displayOrder: 'randomly',
            options: [
              {
                id: 'A',
                content: [{ type: 'text', content: 'A' }],
                isCorrect: true,
              },
              {
                id: 'B',
                content: [{ type: 'text', content: 'B' }],
                isCorrect: false,
              },
            ],
          },
        },
        QuestionType.SINGLE_CHOICE,
      ),
    ).toThrow(
      new BadRequestException(
        'payload.displayOrder must be original or shuffle',
      ),
    );
  });

  it('accepts FILL_TEXT blanks with Vietnamese answers', () => {
    expect(
      validateQuestionContent(
        {
          _version: 2,
          type: QuestionType.FILL_TEXT,
          stem: [
            { type: 'text', content: 'Tác giả là ' },
            { type: 'blank', blankId: 'B1' },
          ],
          payload: {
            blanks: [{ id: 'B1', correctValue: 'Nguyễn Du', caseSensitive: false }],
          },
        },
        QuestionType.FILL_TEXT,
      ),
    ).toBeDefined();
  });

  it('normalizes legacy passage nodes before validating a bundle', () => {
    const normalized = normalizeRichTextArray([
      { type: 'paragraph', content: '[1] Nội dung bài đọc' },
      { text: '[2] Đoạn tiếp theo' },
      { type: 'line_break' },
    ]);
    expect(() => validateRichTextArray(normalized, 'contentJson')).not.toThrow();
    expect(normalized).toEqual([
      { type: 'text', content: '[1] Nội dung bài đọc' },
      { type: 'text', content: '[2] Đoạn tiếp theo' },
      { type: 'break' },
    ]);
  });
});
