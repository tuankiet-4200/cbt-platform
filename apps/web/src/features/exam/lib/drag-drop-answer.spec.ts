import { describe, expect, it } from 'vitest';
import { getDragDropCorrectAnswerRows } from './drag-drop-answer';

describe('drag-drop correct answer display', () => {
  it('resolves technical item ids to their visible rich-text content', () => {
    const rows = getDragDropCorrectAnswerRows({
      items: [
        { id: 'I1', content: [{ type: 'text', content: 'ứng dụng cơ bản' }] },
        { id: 'I6', content: [{ type: 'latex', content: '\\frac{1}{3}' }] },
      ],
      slots: [
        { id: 'slot1', correctItemId: 'I6' },
        { id: 'slot2', correctItemId: 'I1' },
      ],
    });

    expect(rows).toEqual([
      {
        slotId: 'slot1',
        itemId: 'I6',
        label: 'Vị trí 1',
        content: [{ type: 'latex', content: '\\frac{1}{3}' }],
      },
      {
        slotId: 'slot2',
        itemId: 'I1',
        label: 'Vị trí 2',
        content: [{ type: 'text', content: 'ứng dụng cơ bản' }],
      },
    ]);
  });

  it('keeps a readable fallback for legacy items without content', () => {
    expect(getDragDropCorrectAnswerRows({
      items: [{ id: 'I2' }],
      slots: [{ id: 'slot1', correctItemId: 'I2' }],
    })[0]).toEqual(expect.objectContaining({
      label: 'Vị trí 1',
      content: [{ type: 'text', content: 'I2' }],
    }));
  });
});
