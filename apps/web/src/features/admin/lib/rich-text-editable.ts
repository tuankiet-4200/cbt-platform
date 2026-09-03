import type { RichTextNode } from '../api/questionBank.api';

const IMAGE_TOKEN_PATTERN = String.raw`\{\{image\|[^}]+\}\}`;

export function appendImageToken(
  value: string,
  url: string,
  alt: string,
  width: number,
) {
  const token = `{{image|${encodeURIComponent(url)}|${encodeURIComponent(alt)}|${width}}}`;
  if (!value) return token;
  return `${value}${value.endsWith('\n') ? '' : '\n'}${token}`;
}

export function richTextToEditableText(nodes: RichTextNode[]) {
  return nodes
    .map((node) => {
      if (node.type === 'latex') return `$${node.content ?? ''}$`;
      if (node.type === 'latex_block') return `$$${node.content ?? ''}$$`;
      if (node.type === 'image' && node.url) {
        return `{{image|${encodeURIComponent(node.url)}|${encodeURIComponent(node.alt ?? 'Hình minh họa')}|${node.width ?? 640}}}`;
      }
      if (node.type === 'blank') return `{{${node.blankId ?? ''}}}`;
      if (node.type === 'break') return '\n';
      return node.content ?? '';
    })
    .join('');
}

export function parseRichText(value: string, includeBlanks = false): RichTextNode[] {
  const blankPattern = includeBlanks ? String.raw`|\{\{[A-Za-z0-9_-]+\}\}` : '';
  const pattern = new RegExp(`(${IMAGE_TOKEN_PATTERN}${blankPattern}|\\$\\$[^$]+\\$\\$|\\$[^$]+\\$|\\n)`, 'g');
  const nodes: RichTextNode[] = [];
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push({ type: 'text', content: value.slice(cursor, index) });
    const token = match[0];
    if (token === '\n') nodes.push({ type: 'break' });
    else if (token.startsWith('{{image|')) nodes.push(parseImageToken(token));
    else if (token.startsWith('{{') && token.endsWith('}}')) nodes.push({ type: 'blank', blankId: token.slice(2, -2) });
    else if (token.startsWith('$$')) nodes.push({ type: 'latex_block', content: token.slice(2, -2) });
    else nodes.push({ type: 'latex', content: token.slice(1, -1) });
    cursor = index + token.length;
  }
  if (cursor < value.length) nodes.push({ type: 'text', content: value.slice(cursor) });
  return nodes.filter((node) => node.type === 'break' || node.type === 'blank' || node.type === 'image' || Boolean(node.content?.trim()));
}

function parseImageToken(token: string): RichTextNode {
  const [encodedUrl = '', encodedAlt = '', widthText = ''] = token.slice(8, -2).split('|');
  const width = Number(widthText);
  return {
    type: 'image',
    url: safeDecode(encodedUrl),
    alt: safeDecode(encodedAlt) || 'Hình minh họa',
    ...(Number.isFinite(width) && width > 0 ? { width } : {}),
  };
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
