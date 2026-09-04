import { Prisma, QuestionType } from '@prisma/client';

type JsonRecord = Record<string, Prisma.JsonValue | undefined>;

export function gradeQuestion(
  questionType: QuestionType,
  contentJson: Prisma.JsonValue,
  answerJson: Prisma.JsonValue | null,
): boolean {
  const content = asRecord(contentJson);
  const payload = asRecord(content?.payload);
  const answer = asRecord(answerJson);
  if (!payload || !answer) return false;

  switch (questionType) {
    case QuestionType.SINGLE_CHOICE: {
      const correct = asArray(payload.options)
        .map(asRecord)
        .find((option) => option?.isCorrect === true);
      return (
        typeof correct?.id === 'string' &&
        answer.selectedOptionId === correct.id
      );
    }
    case QuestionType.MULTIPLE_CHOICE: {
      const expected = asArray(payload.options)
        .map(asRecord)
        .filter((option) => option?.isCorrect === true)
        .map((option) => option?.id)
        .filter(isString)
        .sort();
      const submitted = asArray(answer.selectedOptionIds)
        .filter(isString)
        .sort();
      return expected.length > 0 && sameArray(expected, submitted);
    }
    case QuestionType.TRUE_FALSE_MATRIX: {
      const statements = asArray(payload.statements)
        .map(asRecord)
        .filter(isPresent);
      const submitted = new Map(
        asArray(answer.answers)
          .map(asRecord)
          .filter(isPresent)
          .filter(
            (item) =>
              typeof item.statementId === 'string' &&
              typeof item.value === 'boolean',
          )
          .map((item) => [item.statementId as string, item.value as boolean]),
      );
      return (
        statements.length > 0 &&
        statements.every(
          (statement) =>
            typeof statement.id === 'string' &&
            typeof statement.isTrue === 'boolean' &&
            submitted.get(statement.id) === statement.isTrue,
        )
      );
    }
    case QuestionType.DRAG_DROP: {
      const slots = asArray(payload.slots).map(asRecord).filter(isPresent);
      const submitted = new Map(
        asArray(answer.slots)
          .map(asRecord)
          .filter(isPresent)
          .filter(
            (item) =>
              typeof item.slotId === 'string' &&
              typeof item.itemId === 'string',
          )
          .map((item) => [item.slotId as string, item.itemId as string]),
      );
      return (
        slots.length > 0 &&
        slots.every(
          (slot) =>
            typeof slot.id === 'string' &&
            typeof slot.correctItemId === 'string' &&
            submitted.get(slot.id) === slot.correctItemId,
        )
      );
    }
    case QuestionType.FILL_NUMBER: {
      const blanks = asArray(payload.blanks).map(asRecord).filter(isPresent);
      const submitted = new Map(
        asArray(answer.blanks)
          .map(asRecord)
          .filter(isPresent)
          .filter((item) => typeof item.blankId === 'string')
          .map((item) => [item.blankId as string, item.value]),
      );
      return (
        blanks.length > 0 &&
        blanks.every((blank) => {
          if (
            typeof blank.id !== 'string' ||
            (typeof blank.correctValue !== 'string' &&
              typeof blank.correctValue !== 'number')
          ) {
            return false;
          }
          const submittedValue = submitted.get(blank.id);
          const expected = toExactNumberText(blank.correctValue);
          const submittedText = toExactNumberText(submittedValue);
          return expected !== null && submittedText === expected;
        })
      );
    }
    case QuestionType.FILL_TEXT: {
      const blanks = asArray(payload.blanks).map(asRecord).filter(isPresent);
      const submitted = new Map(
        asArray(answer.blanks)
          .map(asRecord)
          .filter(isPresent)
          .filter((item) => typeof item.blankId === 'string')
          .map((item) => [item.blankId as string, item.value]),
      );
      return (
        blanks.length > 0 &&
        blanks.every((blank) => {
          if (typeof blank.id !== 'string' || typeof blank.correctValue !== 'string') return false;
          const submittedValue = submitted.get(blank.id);
          if (typeof submittedValue !== 'string') return false;
          return normalizeTextAnswer(submittedValue, blank.caseSensitive === true) ===
            normalizeTextAnswer(blank.correctValue, blank.caseSensitive === true);
        })
      );
    }
  }
}

export function extractCorrectAnswer(
  questionType: QuestionType,
  contentJson: Prisma.JsonValue,
): Prisma.InputJsonValue {
  const payload = asRecord(asRecord(contentJson)?.payload);
  if (!payload) return {};

  switch (questionType) {
    case QuestionType.SINGLE_CHOICE:
      return {
        selectedOptionId:
          asArray(payload.options)
            .map(asRecord)
            .find((option) => option?.isCorrect === true)?.id ?? null,
      };
    case QuestionType.MULTIPLE_CHOICE:
      return {
        selectedOptionIds: asArray(payload.options)
          .map(asRecord)
          .filter((option) => option?.isCorrect === true)
          .map((option) => option?.id)
          .filter(isString),
      };
    case QuestionType.TRUE_FALSE_MATRIX:
      return {
        answers: asArray(payload.statements)
          .map(asRecord)
          .filter(isPresent)
          .map((statement) => ({
            statementId: String(statement.id ?? ''),
            value: Boolean(statement.isTrue),
          })),
      };
    case QuestionType.DRAG_DROP:
      return {
        slots: asArray(payload.slots)
          .map(asRecord)
          .filter(isPresent)
          .map((slot) => ({
            slotId: String(slot.id ?? ''),
            itemId: String(slot.correctItemId ?? ''),
          })),
      };
    case QuestionType.FILL_NUMBER:
      return {
        blanks: asArray(payload.blanks)
          .map(asRecord)
          .filter(isPresent)
          .map((blank) => ({
            blankId: String(blank.id ?? ''),
            value:
              typeof blank.correctValue === 'string' ||
              typeof blank.correctValue === 'number'
                ? (toExactNumberText(blank.correctValue) ?? '')
                : '',
          })),
      };
    case QuestionType.FILL_TEXT:
      return {
        blanks: asArray(payload.blanks)
          .map(asRecord)
          .filter(isPresent)
          .map((blank) => ({
            blankId: String(blank.id ?? ''),
            value: typeof blank.correctValue === 'string' ? blank.correctValue : '',
          })),
      };
  }
}

function asRecord(value: Prisma.JsonValue | undefined): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asArray(value: Prisma.JsonValue | undefined): Prisma.JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function isString(value: Prisma.JsonValue | undefined): value is string {
  return typeof value === 'string';
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function sameArray(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function toExactNumberText(value: Prisma.JsonValue | undefined): string | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value).replace('.', ',') : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^[+-]?\d+(?:,\d+)?$/.test(trimmed) ? trimmed : null;
}

function normalizeTextAnswer(value: string, caseSensitive: boolean) {
  const normalized = value.normalize('NFC').trim().replace(/\s+/g, ' ');
  return caseSensitive ? normalized : normalized.toLocaleLowerCase('vi-VN');
}
