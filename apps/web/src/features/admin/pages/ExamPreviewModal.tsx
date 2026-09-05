import { useState, type ReactNode } from 'react';
import { FileText, Layers, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RichText } from '@/features/exam/components/RichText';
import { getDragDropCorrectAnswerRows } from '@/features/exam/lib/drag-drop-answer';
import type {
  ExamPreview,
  ExamPreviewBundle,
  ExamPreviewQuestion,
} from '../api/exams.api';
import type { ExamSectionType, RichTextNode } from '../api/questionBank.api';
import { COGNITIVE_LEVELS, cognitiveLevelLabel } from '../lib/question-labels';

const SECTIONS: ExamSectionType[] = ['MATH', 'READING', 'SCIENCE'];

interface ExamPreviewModalProps {
  preview: ExamPreview;
  onClose: () => void;
}

export function ExamPreviewModal({ preview, onClose }: ExamPreviewModalProps) {
  const [activeSection, setActiveSection] = useState<ExamSectionType>('MATH');
  const [selectedQuestion, setSelectedQuestion] = useState<ExamPreviewQuestion | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<ExamPreviewBundle | null>(null);
  const activePreview = preview.sections[activeSection];

  const inspectQuestion = (question: ExamPreviewQuestion, bundle?: ExamPreviewBundle) => {
    setSelectedQuestion(question);
    setSelectedBundle(bundle ?? null);
  };

  const inspectBundle = (bundle: ExamPreviewBundle) => {
    setSelectedBundle(bundle);
    setSelectedQuestion(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/40 px-4 py-6 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <header className="border-b border-neutral-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
                <FileText className="h-4 w-4" />
                Exam preview
              </div>
              <h2 className="mt-1 text-xl font-bold text-neutral-900">{preview.title}</h2>
              <p className="mt-1 text-sm text-neutral-500">
                {preview.durationMins} phut · {preview.totalPoints} points · Seed {preview.generationSeed ?? '-'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="border-b border-neutral-200 p-4 lg:border-b-0 lg:border-r">
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {SECTIONS.map((section) => {
                const sectionPreview = preview.sections[section];
                return (
                  <button
                    key={section}
                    type="button"
                    onClick={() => setActiveSection(section)}
                    className={cn(
                      'rounded-lg border p-3 text-left transition',
                      activeSection === section
                        ? 'border-primary-200 bg-primary-50 text-primary-800'
                        : 'border-neutral-200 hover:bg-neutral-50',
                    )}
                  >
                    <p className="text-sm font-semibold">{section}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {sectionPreview.itemCount} items · {sectionPreview.questionCount} questions
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Items" value={activePreview.itemCount} />
              <MetricCard label="Questions" value={activePreview.questionCount} />
              <MetricCard label="Status" value={preview.isPublished ? 'Published' : 'Draft'} />
            </div>

            <section className="mt-5">
              <h3 className="text-sm font-semibold text-neutral-900">Mức độ</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {COGNITIVE_LEVELS.map((level) => (
                  <MetricMini key={level} label={cognitiveLevelLabel(level)} value={activePreview.difficulty[level] ?? 0} />
                ))}
              </div>
            </section>

            {(selectedQuestion || selectedBundle) && (
              <section className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900">
                      {selectedQuestion ? 'Chi tiết câu hỏi' : 'Chi tiết ngữ liệu'}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      {selectedQuestion ? `Câu ${selectedQuestion.order + 1}` : selectedBundle?.title ?? 'Bundle'}
                    </p>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setSelectedQuestion(null); setSelectedBundle(null); }}>
                    <X className="h-4 w-4" />
                    Close
                  </button>
                </div>
                {selectedBundle && !selectedQuestion && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Passage / stimulus</h4>
                    <div className="mt-2 rounded-lg bg-white p-4 text-sm leading-7 text-neutral-800">
                      <RichText nodes={selectedBundle.contentJson ?? []} />
                    </div>
                    {selectedBundle.tags.length > 0 && <TagList tags={selectedBundle.tags} />}
                  </div>
                )}
                {selectedQuestion && (
                  <QuestionDetail question={selectedQuestion} bundle={selectedBundle} />
                )}
              </section>
            )}

            <section className="mt-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <Layers className="h-4 w-4 text-primary-600" />
                Section items
              </div>
              <div className="mt-3 space-y-3">
                {activeSection === 'MATH'
                  ? (preview.sections.MATH.items ?? []).map((question) => (
                      <QuestionRow key={question.id} question={question} onInspect={() => inspectQuestion(question)} />
                    ))
                  : ((preview.sections[activeSection].bundles ?? []) as ExamPreviewBundle[]).map((bundle) => (
                      <BundleRow key={bundle.id} bundle={bundle} onInspectBundle={() => inspectBundle(bundle)} onInspectQuestion={inspectQuestion} />
                    ))}
                {activePreview.itemCount === 0 && (
                  <p className="rounded-lg bg-neutral-50 p-6 text-center text-sm text-neutral-500">Chua co item trong section nay.</p>
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

function QuestionRow({ question, embedded = false, onInspect }: { question: ExamPreviewQuestion; embedded?: boolean; onInspect: () => void }) {
  if (embedded) {
    return (
      <div className="border-t border-neutral-100 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-800">
              #{question.order + 1} · {question.type}
            </p>
            <div className="mt-1 max-h-14 overflow-hidden text-sm leading-6 text-neutral-600 [&_.katex-display]:my-1 [&_img]:max-h-12">
              <RichText nodes={question.contentJson?.stem ?? []} />
            </div>
          </div>
          <span className="badge badge-neutral w-fit">{cognitiveLevelLabel(question.level)}</span>
        </div>
        <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800" onClick={onInspect}>
          <Search className="h-3.5 w-3.5" />
          Inspect
        </button>
      </div>
    );
  }

  return (
    <article className="rounded-lg border border-neutral-200 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            #{question.order + 1} · {question.type}
          </p>
          <div className="mt-1 max-h-14 overflow-hidden text-sm leading-6 text-neutral-600 [&_.katex-display]:my-1 [&_img]:max-h-12">
            <RichText nodes={question.contentJson?.stem ?? []} />
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="badge badge-neutral w-fit">{cognitiveLevelLabel(question.level)}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onInspect}>
            <Search className="h-4 w-4" />
            Inspect
          </button>
        </div>
      </div>
      {question.tags && question.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {question.tags.map((tag) => (
            <span key={tag.id} className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function BundleRow({ bundle, onInspectBundle, onInspectQuestion }: {
  bundle: ExamPreviewBundle;
  onInspectBundle: () => void;
  onInspectQuestion: (question: ExamPreviewQuestion, bundle: ExamPreviewBundle) => void;
}) {
  return (
    <article className="rounded-lg border border-neutral-200 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            Bundle #{bundle.order + 1} · {bundle.title ?? 'Untitled bundle'}
          </p>
          <div className="mt-1 max-h-14 overflow-hidden text-sm leading-6 text-neutral-600 [&_.katex-display]:my-1 [&_img]:max-h-12">
            <RichText nodes={bundle.contentJson ?? []} />
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="badge badge-neutral w-fit">{bundle.questions.length} questions</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onInspectBundle}>
            <Search className="h-4 w-4" />
            Inspect passage
          </button>
        </div>
      </div>
      {bundle.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {bundle.tags.map((tag) => (
            <span key={tag.id} className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
              {tag.name}
            </span>
          ))}
        </div>
      )}
      <div className="mt-4 space-y-2">
        {bundle.questions.map((question) => (
          <QuestionRow key={question.id} question={question} embedded onInspect={() => onInspectQuestion(question, bundle)} />
        ))}
      </div>
    </article>
  );
}

function QuestionDetail({ question }: { question: ExamPreviewQuestion; bundle: ExamPreviewBundle | null }) {
  const content = question.contentJson;
  return (
    <div className="mt-4 space-y-4">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Đề bài</h4>
        <div className="mt-2 rounded-lg bg-white p-4 text-sm leading-7 text-neutral-800">
          <RichText nodes={content?.stem ?? []} />
        </div>
      </div>
      <QuestionAnswers question={question} />
    </div>
  );
}

function QuestionAnswers({ question }: { question: ExamPreviewQuestion }) {
  const payload = question.contentJson?.payload ?? {};
  const options = recordArray(payload.options);
  const statements = recordArray(payload.statements);
  const blanks = recordArray(payload.blanks);
  const dragDropAnswers = getDragDropCorrectAnswerRows(payload);

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Đáp án</h4>
      <div className="mt-2 space-y-2">
        {options.map((option, index) => (
          <AnswerRow key={String(option.id ?? index)} label={String(option.id ?? index + 1)} correct={option.isCorrect === true}>
            <RichText nodes={richTextNodes(option.content)} />
          </AnswerRow>
        ))}
        {statements.map((statement, index) => (
          <AnswerRow key={String(statement.id ?? index)} label={String(statement.id ?? index + 1)} correct>
            <span className="mr-2"><RichText nodes={richTextNodes(statement.content)} /></span>
            <span className="font-semibold text-success-700">— {statement.isTrue === true ? 'Đúng' : 'Sai'}</span>
          </AnswerRow>
        ))}
        {blanks.map((blank, index) => (
          <AnswerRow key={String(blank.id ?? index)} label={String(blank.id ?? index + 1)} correct>
            <span className="font-semibold text-success-700">
              {String(blank.correctValue ?? '')}{blank.unit ? ` ${String(blank.unit)}` : ''}
            </span>
          </AnswerRow>
        ))}
        {dragDropAnswers.map((row) => (
          <AnswerRow key={row.slotId} label={row.label} correct>
            <RichText nodes={row.content} />
          </AnswerRow>
        ))}
        {options.length === 0 && statements.length === 0 && blanks.length === 0 && dragDropAnswers.length === 0 && (
          <p className="rounded-lg bg-white p-4 text-sm text-neutral-400">Chưa có đáp án.</p>
        )}
      </div>
    </div>
  );
}

function AnswerRow({ label, correct, children }: { label: string; correct?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border bg-white p-3 text-sm leading-6', correct ? 'border-success-200' : 'border-neutral-200')}>
      <span className={cn('flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-xs font-bold', correct ? 'bg-success-100 text-success-700' : 'bg-neutral-100 text-neutral-600')}>
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      {correct && <span className="badge badge-success shrink-0">Đúng</span>}
    </div>
  );
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    : [];
}

function richTextNodes(value: unknown): RichTextNode[] {
  return Array.isArray(value) ? value as RichTextNode[] : [];
}

function TagList({ tags }: { tags: Array<{ id: string; name: string }> }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span key={tag.id} className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
          {tag.name}
        </span>
      ))}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-neutral-900">{value}</p>
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
      <p className="text-[0.68rem] font-semibold uppercase text-neutral-500">{label}</p>
      <p className="mt-1 font-bold text-neutral-900">{value}</p>
    </div>
  );
}
