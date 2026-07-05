import { BadRequestException } from '@nestjs/common';
import { QuestionType } from '@prisma/client';

const QUESTION_TYPES = new Set(Object.values(QuestionType));
const RICH_TEXT_TYPES = new Set([
  'text',
  'latex',
  'latex_block',
  'image',
  'bold',
  'italic',
  'break',
  'blank',
]);

export const DEFAULT_IRT = { a: 1.0, b: 0.0, c: 0.25 };

export interface IrtParams {
  a: number;
  b: number;
  c: number;
}

export function validateIrtParams(value: unknown): IrtParams {
  if (value === undefined || value === null) return DEFAULT_IRT;
  if (!isRecord(value)) {
    throw new BadRequestException('irtParams must be an object');
  }

  const a = numberOrDefault(value.a, DEFAULT_IRT.a);
  const b = numberOrDefault(value.b, DEFAULT_IRT.b);
  const c = numberOrDefault(value.c, DEFAULT_IRT.c);

  if (a < 0 || a > 3) throw new BadRequestException('irtParams.a must be between 0 and 3');
  if (b < -3 || b > 3) throw new BadRequestException('irtParams.b must be between -3 and 3');
  if (c < 0 || c > 0.35) throw new BadRequestException('irtParams.c must be between 0 and 0.35');

  return { a, b, c };
}

export function validateQuestionContent(content: unknown, expectedType?: QuestionType) {
  if (!isRecord(content)) {
    throw new BadRequestException('contentJson must be an object');
  }

  if (content._version !== 2) {
    throw new BadRequestException('contentJson._version must be 2');
  }

  if (typeof content.type !== 'string' || !QUESTION_TYPES.has(content.type as QuestionType)) {
    throw new BadRequestException('contentJson.type is invalid');
  }

  if (expectedType && content.type !== expectedType) {
    throw new BadRequestException('Question type must match contentJson.type');
  }

  validateRichTextArray(content.stem, 'contentJson.stem');
  if (content.solution !== undefined) {
    validateRichTextArray(content.solution, 'contentJson.solution');
  }

  if (!isRecord(content.payload)) {
    throw new BadRequestException('contentJson.payload must be an object');
  }

  switch (content.type) {
    case QuestionType.SINGLE_CHOICE:
      validateChoicePayload(content.payload, true);
      break;
    case QuestionType.MULTIPLE_CHOICE:
      validateChoicePayload(content.payload, false);
      break;
    case QuestionType.TRUE_FALSE_MATRIX:
      validateTrueFalsePayload(content.payload);
      break;
    case QuestionType.DRAG_DROP:
      validateDragDropPayload(content.payload);
      break;
    case QuestionType.FILL_NUMBER:
      validateFillNumberPayload(content.payload, content.stem);
      break;
    default:
      throw new BadRequestException('Unsupported question type');
  }

  return content;
}

export function validateRichTextArray(value: unknown, path: string) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestException(`${path} must be a non-empty RichTextNode[]`);
  }

  value.forEach((node, index) => validateRichTextNode(node, `${path}[${index}]`));
}

function validateRichTextNode(value: unknown, path: string) {
  if (!isRecord(value) || typeof value.type !== 'string' || !RICH_TEXT_TYPES.has(value.type)) {
    throw new BadRequestException(`${path}.type is invalid`);
  }

  if (['text', 'latex', 'latex_block', 'bold', 'italic'].includes(value.type)) {
    if (typeof value.content !== 'string' || value.content.length === 0) {
      throw new BadRequestException(`${path}.content must be a non-empty string`);
    }
  }

  if (value.type === 'image') {
    if (typeof value.url !== 'string' || value.url.length === 0) {
      throw new BadRequestException(`${path}.url must be a non-empty string`);
    }
    if (value.width !== undefined && !Number.isFinite(Number(value.width))) {
      throw new BadRequestException(`${path}.width must be a number`);
    }
  }

  if (value.type === 'blank' && (typeof value.blankId !== 'string' || value.blankId.length === 0)) {
    throw new BadRequestException(`${path}.blankId must be a non-empty string`);
  }
}

function validateChoicePayload(payload: Record<string, unknown>, exactlyOneCorrect: boolean) {
  const options = payload.options;
  if (!Array.isArray(options) || options.length < 2 || options.length > 5) {
    throw new BadRequestException('payload.options must contain 2-5 options');
  }

  const ids = new Set<string>();
  let correctCount = 0;
  options.forEach((option, index) => {
    if (!isRecord(option)) throw new BadRequestException(`payload.options[${index}] must be an object`);
    if (typeof option.id !== 'string' || option.id.length === 0) {
      throw new BadRequestException(`payload.options[${index}].id is required`);
    }
    if (ids.has(option.id)) throw new BadRequestException('Option ids must be unique');
    ids.add(option.id);
    validateRichTextArray(option.content, `payload.options[${index}].content`);
    if (typeof option.isCorrect !== 'boolean') {
      throw new BadRequestException(`payload.options[${index}].isCorrect must be boolean`);
    }
    if (option.isCorrect) correctCount += 1;
  });

  if (exactlyOneCorrect && correctCount !== 1) {
    throw new BadRequestException('SINGLE_CHOICE must have exactly one correct option');
  }
  if (!exactlyOneCorrect && correctCount < 1) {
    throw new BadRequestException('MULTIPLE_CHOICE must have at least one correct option');
  }
}

function validateTrueFalsePayload(payload: Record<string, unknown>) {
  if (payload.context !== undefined) validateRichTextArray(payload.context, 'payload.context');
  if (!Array.isArray(payload.statements) || payload.statements.length === 0) {
    throw new BadRequestException('payload.statements must be a non-empty array');
  }

  const ids = new Set<string>();
  payload.statements.forEach((statement, index) => {
    if (!isRecord(statement)) throw new BadRequestException(`payload.statements[${index}] must be an object`);
    if (typeof statement.id !== 'string' || statement.id.length === 0) {
      throw new BadRequestException(`payload.statements[${index}].id is required`);
    }
    if (ids.has(statement.id)) throw new BadRequestException('Statement ids must be unique');
    ids.add(statement.id);
    validateRichTextArray(statement.content, `payload.statements[${index}].content`);
    if (typeof statement.isTrue !== 'boolean') {
      throw new BadRequestException(`payload.statements[${index}].isTrue must be boolean`);
    }
  });
}

function validateDragDropPayload(payload: Record<string, unknown>) {
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new BadRequestException('payload.items must be a non-empty array');
  }
  if (!Array.isArray(payload.slots) || payload.slots.length === 0) {
    throw new BadRequestException('payload.slots must be a non-empty array');
  }

  const itemIds = new Set<string>();
  payload.items.forEach((item, index) => {
    if (!isRecord(item)) throw new BadRequestException(`payload.items[${index}] must be an object`);
    if (typeof item.id !== 'string' || item.id.length === 0) {
      throw new BadRequestException(`payload.items[${index}].id is required`);
    }
    if (itemIds.has(item.id)) throw new BadRequestException('Item ids must be unique');
    itemIds.add(item.id);
    validateRichTextArray(item.content, `payload.items[${index}].content`);
  });

  const slotIds = new Set<string>();
  payload.slots.forEach((slot, index) => {
    if (!isRecord(slot)) throw new BadRequestException(`payload.slots[${index}] must be an object`);
    if (typeof slot.id !== 'string' || slot.id.length === 0) {
      throw new BadRequestException(`payload.slots[${index}].id is required`);
    }
    if (slotIds.has(slot.id)) throw new BadRequestException('Slot ids must be unique');
    slotIds.add(slot.id);
    if (slot.label !== undefined) validateRichTextArray(slot.label, `payload.slots[${index}].label`);
    if (typeof slot.correctItemId !== 'string' || !itemIds.has(slot.correctItemId)) {
      throw new BadRequestException(`payload.slots[${index}].correctItemId must reference an item id`);
    }
  });
}

function validateFillNumberPayload(payload: Record<string, unknown>, stem: unknown) {
  if (!Array.isArray(payload.blanks) || payload.blanks.length === 0) {
    throw new BadRequestException('payload.blanks must be a non-empty array');
  }

  const stemBlankIds = new Set(
    Array.isArray(stem)
      ? stem.filter((node) => isRecord(node) && node.type === 'blank').map((node) => String(node.blankId))
      : [],
  );
  const ids = new Set<string>();

  payload.blanks.forEach((blank, index) => {
    if (!isRecord(blank)) throw new BadRequestException(`payload.blanks[${index}] must be an object`);
    if (typeof blank.id !== 'string' || blank.id.length === 0) {
      throw new BadRequestException(`payload.blanks[${index}].id is required`);
    }
    if (ids.has(blank.id)) throw new BadRequestException('Blank ids must be unique');
    ids.add(blank.id);
    if (!stemBlankIds.has(blank.id)) {
      throw new BadRequestException(`payload.blanks[${index}].id must match a stem blankId`);
    }
    if (!Number.isFinite(Number(blank.correctValue))) {
      throw new BadRequestException(`payload.blanks[${index}].correctValue must be a number`);
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberOrDefault(value: unknown, fallback: number) {
  if (value === undefined || value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new BadRequestException('IRT parameters must be numbers');
  }
  return parsed;
}

