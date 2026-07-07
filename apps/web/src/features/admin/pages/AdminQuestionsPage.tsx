import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Edit3, FileText, FlaskConical, ListChecks, Plus, Sigma } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  listPassageBundles,
  listQuestions,
  type AdminQuestion,
  type ExamSectionType,
  type PassageBundle,
  type QuestionStatus,
  type TagNode,
} from '../api/questionBank.api';

type SectionMode = ExamSectionType;

const SECTIONS: Array<{
  value: SectionMode;
  label: string;
  icon: typeof Sigma;
  description: string;
}> = [
  { value: 'MATH', label: 'MATH', icon: Sigma, description: 'Standalone questions used directly in exam assembly.' },
  { value: 'READING', label: 'READING', icon: BookOpen, description: 'Atomic reading passage bundles with exactly 10 questions.' },
  { value: 'SCIENCE', label: 'SCIENCE', icon: FlaskConical, description: 'Atomic science stimulus bundles with exactly 5 questions.' },
];

const STATUS_OPTIONS: Array<{ value: '' | QuestionStatus; label: string }> = [
  { value: '', label: 'All status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_REVIEW', label: 'Pending review' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export default function AdminQuestionsPage() {
  const navigate = useNavigate();
  const [section, setSection] = useState<SectionMode>('MATH');
  const [status, setStatus] = useState<'' | QuestionStatus>('');
  const sectionMeta = SECTIONS.find((item) => item.value === section) ?? SECTIONS[0];

  const mathQuestionsQuery = useQuery({
    queryKey: ['admin', 'questions', 'list', section, status],
    queryFn: () =>
      listQuestions({
        page: 1,
        limit: 50,
        status: status || undefined,
        standaloneOnly: true,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    enabled: section === 'MATH',
  });

  const bundlesQuery = useQuery({
    queryKey: ['admin', 'passage-bundles', 'list', section, status],
    queryFn: () =>
      listPassageBundles({
        page: 1,
        limit: 50,
        sectionType: section === 'MATH' ? '' : section,
        status: status || undefined,
      }),
    enabled: section !== 'MATH',
  });

  const isLoading = section === 'MATH' ? mathQuestionsQuery.isLoading : bundlesQuery.isLoading;
  const total = section === 'MATH'
    ? mathQuestionsQuery.data?.meta?.total ?? mathQuestionsQuery.data?.data.length ?? 0
    : bundlesQuery.data?.meta?.total ?? bundlesQuery.data?.data.length ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
            <ListChecks className="h-4 w-4" />
            Question Bank
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">Quản lý câu hỏi</h1>
          <p className="mt-1 text-sm text-neutral-500">{sectionMeta.description}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select className="input w-full sm:w-52" value={status} onChange={(event) => setStatus(event.target.value as '' | QuestionStatus)}>
            {STATUS_OPTIONS.map((item) => (
              <option key={item.value || 'all'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <span className="badge badge-neutral h-9 justify-center px-3">{total} items</span>
        </div>
      </header>

      <section className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-2 sm:grid-cols-3">
            {SECTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSection(value)}
                className={cn(
                  'flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition',
                  section === value ? 'bg-primary-600 text-white' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <button
            className="btn btn-primary btn-md"
            type="button"
            onClick={() => navigate(`/admin/questions/create?section=${section}`)}
          >
            <Plus className="h-4 w-4" />
            Add Question
          </button>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-neutral-200 p-5">
          <h2 className="font-semibold text-neutral-900">
            {section === 'MATH' ? 'Standalone MATH questions' : `${section} passage bundles`}
          </h2>
        </div>

        {isLoading ? (
          <p className="p-8 text-center text-sm text-neutral-500">Đang tải danh sách...</p>
        ) : section === 'MATH' ? (
          <MathQuestionList questions={mathQuestionsQuery.data?.data ?? []} />
        ) : (
          <BundleQuestionList bundles={bundlesQuery.data?.data ?? []} />
        )}
      </section>
    </div>
  );
}

function MathQuestionList({ questions }: { questions: AdminQuestion[] }) {
  if (questions.length === 0) {
    return <p className="p-8 text-center text-sm text-neutral-500">Chưa có câu hỏi MATH phù hợp.</p>;
  }

  return (
    <div className="divide-y divide-neutral-100">
      {questions.map((question) => (
        <article key={question.id} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('badge', statusBadgeClass(question.status))}>{question.status}</span>
              <span className="badge badge-neutral">{question.type}</span>
              <span className="badge badge-primary">{question.level}</span>
            </div>
            <p className="mt-3 font-medium text-neutral-900">{summarizeRichText(question.contentJson.stem)}</p>
            <TagBadges tags={question.tags.map(({ tag }) => tag)} />
          </div>
          <Link className="btn btn-secondary btn-md" to={`/admin/questions/${question.id}/edit?section=MATH`}>
            <Edit3 className="h-4 w-4" />
            Edit
          </Link>
        </article>
      ))}
    </div>
  );
}

function BundleQuestionList({ bundles }: { bundles: PassageBundle[] }) {
  if (bundles.length === 0) {
    return <p className="p-8 text-center text-sm text-neutral-500">Chưa có bundle phù hợp.</p>;
  }

  return (
    <div className="divide-y divide-neutral-100">
      {bundles.map((bundle) => (
        <article key={bundle.id} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('badge', statusBadgeClass(bundle.status))}>{bundle.status}</span>
              <span className="badge badge-primary">{bundle.sectionType}</span>
              <span className="badge badge-neutral">{bundle.questions.length} questions</span>
            </div>
            <div className="mt-3 flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600" />
              <p className="font-medium text-neutral-900">{bundle.title}</p>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-neutral-500">{summarizeRichText(bundle.contentJson)}</p>
            <TagBadges tags={bundle.tags?.map(({ tag }) => tag) ?? []} />
          </div>
          <Link className="btn btn-secondary btn-md" to={`/admin/questions/bundles/${bundle.id}/edit?section=${bundle.sectionType}`}>
            <Edit3 className="h-4 w-4" />
            Edit
          </Link>
        </article>
      ))}
    </div>
  );
}

function TagBadges({ tags }: { tags: TagNode[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span key={tag.id} className="badge badge-neutral">{tag.name}</span>
      ))}
    </div>
  );
}

function statusBadgeClass(status: QuestionStatus) {
  if (status === 'PUBLISHED') return 'badge-success';
  if (status === 'PENDING_REVIEW') return 'badge-warning';
  if (status === 'ARCHIVED') return 'badge-danger';
  return 'badge-neutral';
}

function summarizeRichText(nodes: Array<{ type: string; content?: string; blankId?: string }>) {
  return nodes
    .map((node) => {
      if (node.type === 'latex' || node.type === 'latex_block') return `$${node.content ?? ''}$`;
      if (node.type === 'blank') return `[${node.blankId}]`;
      if (node.type === 'break') return ' ';
      return node.content ?? '';
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Không có nội dung tóm tắt.';
}
