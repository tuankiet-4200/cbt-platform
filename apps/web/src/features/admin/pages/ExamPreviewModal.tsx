import { useState } from 'react';
import { FileText, Layers, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  ExamPreview,
  ExamPreviewBundle,
  ExamPreviewQuestion,
} from '../api/exams.api';
import type { CognitiveLevel, ExamSectionType } from '../api/questionBank.api';

const SECTIONS: ExamSectionType[] = ['MATH', 'READING', 'SCIENCE'];
const LEVELS: CognitiveLevel[] = ['RECOGNITION', 'COMPREHENSION', 'APPLICATION', 'HIGH_APPLICATION'];

interface ExamPreviewModalProps {
  preview: ExamPreview;
  onClose: () => void;
}

export function ExamPreviewModal({ preview, onClose }: ExamPreviewModalProps) {
  const [activeSection, setActiveSection] = useState<ExamSectionType>('MATH');
  const activePreview = preview.sections[activeSection];

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
              <h3 className="text-sm font-semibold text-neutral-900">Difficulty</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {LEVELS.map((level) => (
                  <MetricMini key={level} label={level} value={activePreview.difficulty[level] ?? 0} />
                ))}
              </div>
            </section>

            <section className="mt-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <Layers className="h-4 w-4 text-primary-600" />
                Section items
              </div>
              <div className="mt-3 space-y-3">
                {activeSection === 'MATH'
                  ? (preview.sections.MATH.items ?? []).map((question) => (
                      <QuestionRow key={question.id} question={question} />
                    ))
                  : ((preview.sections[activeSection].bundles ?? []) as ExamPreviewBundle[]).map((bundle) => (
                      <BundleRow key={bundle.id} bundle={bundle} />
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

function QuestionRow({ question, embedded = false }: { question: ExamPreviewQuestion; embedded?: boolean }) {
  if (embedded) {
    return (
      <div className="border-t border-neutral-100 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-800">
              #{question.order + 1} · {question.type}
            </p>
            <p className="mt-1 text-sm text-neutral-600">{question.snippet || 'No preview text'}</p>
          </div>
          <span className="badge badge-neutral w-fit">{question.level}</span>
        </div>
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
          <p className="mt-1 text-sm text-neutral-600">{question.snippet || 'No preview text'}</p>
        </div>
        <span className="badge badge-neutral w-fit">{question.level}</span>
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

function BundleRow({ bundle }: { bundle: ExamPreviewBundle }) {
  return (
    <article className="rounded-lg border border-neutral-200 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            Bundle #{bundle.order + 1} · {bundle.title ?? 'Untitled bundle'}
          </p>
          <p className="mt-1 text-sm text-neutral-600">{bundle.snippet || 'No passage preview'}</p>
        </div>
        <span className="badge badge-neutral w-fit">{bundle.questions.length} questions</span>
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
          <QuestionRow key={question.id} question={question} embedded />
        ))}
      </div>
    </article>
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
