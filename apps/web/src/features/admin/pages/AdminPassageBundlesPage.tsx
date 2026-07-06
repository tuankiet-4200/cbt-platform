import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Files, Loader2, Plus, Search } from 'lucide-react';
import {
  createPassageBundle,
  listPassageBundles,
  listQuestions,
  type QuestionStatus,
  type RichTextNode,
} from '../api/questionBank.api';
import { cn } from '@/lib/utils';

type BundleSection = 'READING' | 'SCIENCE';

const SECTION_COUNTS: Record<BundleSection, number> = {
  READING: 10,
  SCIENCE: 5,
};

export default function AdminPassageBundlesPage() {
  const queryClient = useQueryClient();
  const [sectionType, setSectionType] = useState<BundleSection>('READING');
  const [status, setStatus] = useState<QuestionStatus>('DRAFT');
  const [title, setTitle] = useState('');
  const [passage, setPassage] = useState('');
  const [expectedTimeSecs, setExpectedTimeSecs] = useState(900);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const bundlesQuery = useQuery({
    queryKey: ['admin', 'passage-bundles', sectionType],
    queryFn: () => listPassageBundles({ page: 1, limit: 20, sectionType }),
  });

  const questionsQuery = useQuery({
    queryKey: ['admin', 'questions', 'bundle-candidates'],
    queryFn: () => listQuestions({ page: 1, limit: 100, status: 'PUBLISHED', sortBy: 'createdAt', sortOrder: 'desc' }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createPassageBundle({
        sectionType,
        title,
        status,
        expectedTimeSecs,
        contentJson: parseRichText(passage),
        questions: selectedQuestionIds.map((questionId, index) => ({
          questionId,
          orderInBundle: index + 1,
          points: 1,
        })),
      }),
    onSuccess: () => {
      setTitle('');
      setPassage('');
      setSelectedQuestionIds([]);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'passage-bundles'] });
    },
  });

  const expectedCount = SECTION_COUNTS[sectionType];
  const bundles = bundlesQuery.data?.data ?? [];
  const candidateQuestions = questionsQuery.data?.data ?? [];
  const selectedQuestions = useMemo(
    () => candidateQuestions.filter((question) => selectedQuestionIds.includes(question.id)),
    [candidateQuestions, selectedQuestionIds],
  );

  const submit = () => {
    setFormError(null);
    if (!title.trim()) {
      setFormError('Title không được để trống.');
      return;
    }
    if (parseRichText(passage).length === 0) {
      setFormError('Passage content không được để trống.');
      return;
    }
    if (selectedQuestionIds.length !== expectedCount) {
      setFormError(`${sectionType} bundle cần đúng ${expectedCount} câu hỏi.`);
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
            <Files className="h-4 w-4" />
            PassageBundle Bank
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">PassageBundles</h1>
          <p className="mt-1 text-sm text-neutral-500">Tạo bundle Đọc hiểu/Khoa học theo đơn vị atomic đúng 10/5 câu.</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm">
          <span className="font-semibold text-neutral-900">{selectedQuestionIds.length}</span>
          <span className="text-neutral-500"> / {expectedCount} selected</span>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="card p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <label>
              <span className="label">Section</span>
              <select
                className="input"
                value={sectionType}
                onChange={(event) => {
                  setSectionType(event.target.value as BundleSection);
                  setSelectedQuestionIds([]);
                }}
              >
                <option value="READING">READING</option>
                <option value="SCIENCE">SCIENCE</option>
              </select>
            </label>
            <label>
              <span className="label">Status</span>
              <select className="input" value={status} onChange={(event) => setStatus(event.target.value as QuestionStatus)}>
                <option value="DRAFT">Draft</option>
                <option value="PENDING_REVIEW">Pending review</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </label>
            <label>
              <span className="label">Expected time</span>
              <input
                className="input"
                type="number"
                min={60}
                max={7200}
                value={expectedTimeSecs}
                onChange={(event) => setExpectedTimeSecs(Number(event.target.value))}
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="label">Title</span>
            <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>

          <label className="mt-4 block">
            <span className="label">Passage / stimulus</span>
            <textarea
              className="input min-h-48 resize-y"
              value={passage}
              onChange={(event) => setPassage(event.target.value)}
              placeholder="Hỗ trợ LaTeX inline bằng $...$ và block bằng $$...$$"
            />
          </label>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-neutral-800">Question candidates</h2>
              <span className={cn('badge', selectedQuestionIds.length === expectedCount ? 'badge-success' : 'badge-warning')}>
                {sectionType}: {expectedCount} required
              </span>
            </div>
            <div className="mt-3 max-h-96 overflow-y-auto rounded-lg border border-neutral-200">
              {candidateQuestions.map((question) => (
                <label key={question.id} className="flex items-start gap-3 border-b border-neutral-100 p-3 text-sm last:border-0">
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={selectedQuestionIds.includes(question.id)}
                    onChange={(event) => {
                      if (event.target.checked) {
                        if (selectedQuestionIds.length >= expectedCount) return;
                        setSelectedQuestionIds((ids) => [...ids, question.id]);
                      } else {
                        setSelectedQuestionIds((ids) => ids.filter((id) => id !== question.id));
                      }
                    }}
                  />
                  <span>
                    <span className="font-medium text-neutral-900">{summarizeRichText(question.contentJson.stem)}</span>
                    <span className="mt-1 block text-xs text-neutral-500">{question.type} · {question.level}</span>
                  </span>
                </label>
              ))}
              {!questionsQuery.isLoading && candidateQuestions.length === 0 && (
                <div className="p-8 text-center text-sm text-neutral-500">Chưa có published questions để link.</div>
              )}
            </div>
          </div>

          {(formError || createMutation.error) && (
            <p className="mt-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
              {formError ?? getErrorMessage(createMutation.error)}
            </p>
          )}

          <div className="mt-5 flex justify-end">
            <button className="btn btn-primary btn-md" disabled={createMutation.isPending} onClick={submit}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Tạo bundle
            </button>
          </div>
        </div>

        <aside className="card p-5">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Search className="h-4 w-4" />
            {bundlesQuery.isFetching ? 'Đang tải bundles...' : `${bundles.length} bundles`}
          </div>
          <div className="mt-4 space-y-3">
            {bundles.map((bundle) => (
              <article key={bundle.id} className="rounded-lg border border-neutral-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-neutral-900">{bundle.title}</h2>
                  <span className="badge badge-primary">{bundle.sectionType}</span>
                </div>
                <p className="mt-2 text-sm text-neutral-500">{bundle.questions.length} questions · {bundle.status}</p>
              </article>
            ))}
            {!bundlesQuery.isLoading && bundles.length === 0 && (
              <p className="rounded-lg bg-neutral-50 p-4 text-sm text-neutral-500">Chưa có bundle cho section này.</p>
            )}
          </div>

          <div className="mt-6 border-t border-neutral-200 pt-5">
            <h2 className="text-sm font-semibold text-neutral-800">Selected order</h2>
            <ol className="mt-3 space-y-2 text-sm text-neutral-600">
              {selectedQuestions.map((question, index) => (
                <li key={question.id} className="rounded-md bg-neutral-50 px-3 py-2">
                  {index + 1}. {summarizeRichText(question.contentJson.stem)}
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </section>
    </div>
  );
}

function parseRichText(value: string): RichTextNode[] {
  const nodes: RichTextNode[] = [];
  const pattern = /(\$\$[^$]+\$\$|\$[^$]+\$|\n)/g;
  let cursor = 0;

  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push({ type: 'text', content: value.slice(cursor, index) });
    const token = match[0];
    if (token === '\n') nodes.push({ type: 'break' });
    else if (token.startsWith('$$')) nodes.push({ type: 'latex_block', content: token.slice(2, -2) });
    else nodes.push({ type: 'latex', content: token.slice(1, -1) });
    cursor = index + token.length;
  }

  if (cursor < value.length) nodes.push({ type: 'text', content: value.slice(cursor) });
  return nodes.filter((node) => node.type === 'break' || Boolean(node.content?.trim()));
}

function summarizeRichText(nodes: RichTextNode[]) {
  return nodes
    .map((node) => {
      if (node.type === 'latex' || node.type === 'latex_block') return `$${node.content ?? ''}$`;
      if (node.type === 'blank') return `[${node.blankId}]`;
      if (node.type === 'break') return ' ';
      return node.content ?? '';
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Không thể tạo bundle.';
}
