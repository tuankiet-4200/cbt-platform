import { describe, expect, it } from 'vitest';
import { appendImageToken, parseRichText, richTextToEditableText } from './rich-text-editable';

describe('rich text editable image tokens', () => {
  it('appends and parses an uploaded image alongside text and LaTeX', () => {
    const editable = appendImageToken('Cho biểu thức $x^2$', 'https://cdn.test/question image.png', 'Hình | số 1', 640);

    expect(parseRichText(editable)).toEqual([
      { type: 'text', content: 'Cho biểu thức ' },
      { type: 'latex', content: 'x^2' },
      { type: 'break' },
      { type: 'image', url: 'https://cdn.test/question image.png', alt: 'Hình | số 1', width: 640 },
    ]);
  });

  it('preserves image nodes when an existing question is opened and saved', () => {
    const nodes = [
      { type: 'text' as const, content: 'Chọn hình đúng:' },
      { type: 'image' as const, url: 'https://cdn.test/a.webp', alt: 'Đáp án A', width: 260 },
    ];

    expect(parseRichText(richTextToEditableText(nodes))).toEqual(nodes);
  });

  it('parses inline slot tokens when blank support is enabled', () => {
    expect(parseRichText('S = ({{slot1}}; {{slot2}})', true)).toEqual([
      { type: 'text', content: 'S = (' },
      { type: 'blank', blankId: 'slot1' },
      { type: 'text', content: '; ' },
      { type: 'blank', blankId: 'slot2' },
      { type: 'text', content: ')' },
    ]);
  });
});
