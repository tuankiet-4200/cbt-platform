import type { RichTextNode } from '../api/sessions.api';

type UnknownRecord = Record<string, unknown>;

export interface DragDropCorrectAnswerRow {
  slotId: string;
  itemId: string;
  label: string;
  content: RichTextNode[];
}

export function getDragDropCorrectAnswerRows(
  payload: Record<string, unknown>,
): DragDropCorrectAnswerRow[] {
  const items = recordArray(payload.items);
  const slots = recordArray(payload.slots);

  return slots.map((slot, index) => {
    const slotId = stringValue(slot.id);
    const itemId = stringValue(slot.correctItemId);
    const item = items.find((candidate) => candidate.id === itemId);
    const content = richTextNodes(item?.content);

    return {
      slotId,
      itemId,
      label: `Vị trí ${index + 1}`,
      content: content.length > 0
        ? content
        : [{ type: 'text', content: itemId || 'Không xác định' }],
    };
  });
}

function recordArray(value: unknown): UnknownRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is UnknownRecord => item !== null && typeof item === 'object' && !Array.isArray(item),
  );
}

function richTextNodes(value: unknown): RichTextNode[] {
  return Array.isArray(value) ? value as RichTextNode[] : [];
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}
