import { BlockMath, InlineMath } from 'react-katex';
import type { RichTextNode } from '../api/sessions.api';

export function RichText({
  nodes,
  renderBlank,
}: {
  nodes: RichTextNode[];
  renderBlank?: (blankId: string) => React.ReactNode;
}) {
  return (
    <>
      {nodes.map((node, index) => {
        const key = `${node.type}-${index}`;
        if (node.type === 'latex') {
          return <InlineMath key={key} math={node.content} />;
        }
        if (node.type === 'latex_block') {
          return <BlockMath key={key} math={node.content} />;
        }
        if (node.type === 'bold') {
          return <strong key={key}>{node.content}</strong>;
        }
        if (node.type === 'italic') {
          return <em key={key}>{node.content}</em>;
        }
        if (node.type === 'break') {
          return <br key={key} />;
        }
        if (node.type === 'image') {
          return (
            <img
              key={key}
              src={node.url}
              alt={node.alt ?? ''}
              style={{ maxWidth: node.width ? `${node.width}px` : undefined }}
              className="my-4 max-h-[30rem] max-w-full object-contain"
            />
          );
        }
        if (node.type === 'blank') {
          return (
            <span key={key} className="mx-1 inline-flex">
              {renderBlank?.(node.blankId) ?? '______'}
            </span>
          );
        }
        return <span key={key}>{node.content}</span>;
      })}
    </>
  );
}
