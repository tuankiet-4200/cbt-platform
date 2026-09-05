import type { SessionQuestion } from '@/features/exam/api/sessions.api';

type UnknownRecord = Record<string, unknown>;

export function isPracticeAnswerComplete(
  question: SessionQuestion,
  answer?: UnknownRecord,
): boolean {
  if (!answer) return false;
  const payload = question.content.payload;

  switch (question.type) {
    case 'SINGLE_CHOICE':
      return isNonEmptyString(answer.selectedOptionId);
    case 'MULTIPLE_CHOICE':
      return asArray(answer.selectedOptionIds).some(isNonEmptyString);
    case 'TRUE_FALSE_MATRIX': {
      const statements = records(payload.statements);
      const submitted = new Map(
        records(answer.answers)
          .filter((item) => typeof item.statementId === 'string')
          .map((item) => [item.statementId as string, item.value]),
      );
      return statements.length > 0 && statements.every(
        (statement) => typeof statement.id === 'string' &&
          typeof submitted.get(statement.id) === 'boolean',
      );
    }
    case 'DRAG_DROP': {
      const slots = records(payload.slots);
      const submitted = new Map(
        records(answer.slots)
          .filter((item) => typeof item.slotId === 'string')
          .map((item) => [item.slotId as string, item.itemId]),
      );
      return slots.length > 0 && slots.every(
        (slot) => typeof slot.id === 'string' &&
          isNonEmptyString(submitted.get(slot.id)),
      );
    }
    case 'FILL_NUMBER':
    case 'FILL_TEXT': {
      const blanks = records(payload.blanks);
      const submitted = new Map(
        records(answer.blanks)
          .filter((item) => typeof item.blankId === 'string')
          .map((item) => [item.blankId as string, item.value]),
      );
      return blanks.length > 0 && blanks.every((blank) => {
        if (typeof blank.id !== 'string') return false;
        const value = submitted.get(blank.id);
        return (typeof value === 'number' && Number.isFinite(value)) || isNonEmptyString(value);
      });
    }
    default:
      return false;
  }
}

export function gradePracticeAnswer(
  question: SessionQuestion,
  answer?: UnknownRecord,
): boolean {
  if (!answer) return false;
  const payload = question.content.payload;

  switch (question.type) {
    case 'SINGLE_CHOICE': {
      const correct = records(payload.options).find((option) => option.isCorrect === true);
      return typeof correct?.id === 'string' && answer.selectedOptionId === correct.id;
    }
    case 'MULTIPLE_CHOICE': {
      const expected = records(payload.options)
        .filter((option) => option.isCorrect === true)
        .map((option) => option.id)
        .filter(isString)
        .sort();
      const submitted = asArray(answer.selectedOptionIds).filter(isString).sort();
      return expected.length > 0 && sameArray(expected, submitted);
    }
    case 'TRUE_FALSE_MATRIX': {
      const statements = records(payload.statements);
      const submitted = new Map(
        records(answer.answers)
          .filter(
            (item) => typeof item.statementId === 'string' && typeof item.value === 'boolean',
          )
          .map((item) => [item.statementId as string, item.value as boolean]),
      );
      return statements.length > 0 && statements.every(
        (statement) => typeof statement.id === 'string' &&
          typeof statement.isTrue === 'boolean' &&
          submitted.get(statement.id) === statement.isTrue,
      );
    }
    case 'DRAG_DROP': {
      const slots = records(payload.slots);
      const submitted = new Map(
        records(answer.slots)
          .filter((item) => typeof item.slotId === 'string' && typeof item.itemId === 'string')
          .map((item) => [item.slotId as string, item.itemId as string]),
      );
      return slots.length > 0 && slots.every(
        (slot) => typeof slot.id === 'string' &&
          typeof slot.correctItemId === 'string' &&
          submitted.get(slot.id) === slot.correctItemId,
      );
    }
    case 'FILL_NUMBER': {
      const blanks = records(payload.blanks);
      const submitted = submittedBlanks(answer);
      return blanks.length > 0 && blanks.every((blank) => {
        if (
          typeof blank.id !== 'string' ||
          (typeof blank.correctValue !== 'string' && typeof blank.correctValue !== 'number')
        ) {
          return false;
        }
        const expected = toExactNumberText(blank.correctValue);
        return expected !== null && toExactNumberText(submitted.get(blank.id)) === expected;
      });
    }
    case 'FILL_TEXT': {
      const blanks = records(payload.blanks);
      const submitted = submittedBlanks(answer);
      return blanks.length > 0 && blanks.every((blank) => {
        if (typeof blank.id !== 'string' || typeof blank.correctValue !== 'string') return false;
        const value = submitted.get(blank.id);
        return typeof value === 'string' &&
          normalizeTextAnswer(value, blank.caseSensitive === true) ===
            normalizeTextAnswer(blank.correctValue, blank.caseSensitive === true);
      });
    }
    default:
      return false;
  }
}

function submittedBlanks(answer: UnknownRecord) {
  return new Map(
    records(answer.blanks)
      .filter((item) => typeof item.blankId === 'string')
      .map((item) => [item.blankId as string, item.value]),
  );
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function records(value: unknown): UnknownRecord[] {
  return asArray(value).map(asRecord).filter((item): item is UnknownRecord => item !== null);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sameArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function toExactNumberText(value: unknown): string | null {
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
