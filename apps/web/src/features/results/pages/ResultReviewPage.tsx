import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Loader2,
  MinusCircle,
  XCircle,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { RichText } from '@/features/exam/components/RichText';
import {
  getAnswerReview,
  type ReviewBundle,
  type ReviewQuestion,
} from '../api/results.api';

type Filter = 'ALL' | 'WRONG' | 'SKIPPED' | 'CORRECT';

export default function ResultReviewPage() {
  const { attemptId = '' } = useParams();
  const [filter, setFilter] = useState<Filter>('ALL');
  const reviewQuery = useQuery({
    queryKey: ['answer-review', attemptId],
    queryFn: () => getAnswerReview(attemptId),
    enabled: Boolean(attemptId),
  });

  const groups = useMemo(() => {
    if (!reviewQuery.data) return [];
    return [
      {
        section: 'MATH',
        label: 'Tư duy Toán học',
        bundles: [{ id: 'math', title: null, content: [], order: 0, questions: reviewQuery.data.sections.MATH.questions }],
      },
      {
        section: 'READING',
        label: 'Tư duy Đọc hiểu',
        bundles: reviewQuery.data.sections.READING.bundles,
      },
      {
        section: 'SCIENCE',
        label: 'Khoa học và giải quyết vấn đề',
        bundles: reviewQuery.data.sections.SCIENCE.bundles,
      },
    ];
  }, [reviewQuery.data]);

  if (reviewQuery.isLoading) {
    return (
      <div className="flex min-h-96 items-center justify-center gap-3 text-neutral-500">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        Đang tải chi tiết bài làm...
      </div>
    );
  }
  if (reviewQuery.isError || !reviewQuery.data) {
    return (
      <div className="card p-8 text-center">
        <XCircle className="mx-auto h-10 w-10 text-danger-500" />
        <h1 className="mt-4 text-xl font-bold">Không thể tải bài làm</h1>
        <Link to={`/results/${attemptId}`} className="btn btn-secondary mt-5">
          Quay lại kết quả
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="card p-5">
        <Link
          to={`/results/${attemptId}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 hover:text-primary-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Kết quả tổng quan
        </Link>
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary-700">Xem lại đáp án</p>
            <h1 className="mt-1 text-2xl font-bold text-neutral-900">
              {reviewQuery.data.exam.title}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'WRONG', 'SKIPPED', 'CORRECT'] as Filter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  filter === value
                    ? 'bg-primary-600 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {filterLabel(value)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {groups.map((group) => {
        const visible = group.bundles
          .map((bundle) => ({
            ...bundle,
            questions: bundle.questions.filter((question) =>
              matchesFilter(question, filter),
            ),
          }))
          .filter((bundle) => bundle.questions.length > 0);
        if (visible.length === 0) return null;
        return (
          <section key={group.section}>
            <h2 className="mb-3 text-lg font-bold text-neutral-900">{group.label}</h2>
            <div className="space-y-4">
              {visible.map((bundle) => (
                <ReviewGroup key={bundle.id} bundle={bundle} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ReviewGroup({ bundle }: { bundle: ReviewBundle }) {
  return (
    <article className={`grid gap-4 ${bundle.content.length ? 'xl:grid-cols-2' : ''}`}>
      {bundle.content.length > 0 && (
        <div className="card max-h-[42rem] overflow-y-auto p-5 text-sm leading-7">
          {bundle.title && <h3 className="mb-4 text-center font-bold">{bundle.title}</h3>}
          <RichText nodes={bundle.content} />
        </div>
      )}
      <div className="space-y-3">
        {bundle.questions.map((question) => (
          <ReviewQuestionCard key={question.id} question={question} />
        ))}
      </div>
    </article>
  );
}

function ReviewQuestionCard({ question }: { question: ReviewQuestion }) {
  const [expanded, setExpanded] = useState(false);
  const skipped = question.userAnswer === null;
  const status = skipped
    ? { icon: MinusCircle, label: 'Bỏ trống', tone: 'text-neutral-600 bg-neutral-100' }
    : question.isCorrect
      ? { icon: CheckCircle2, label: 'Đúng', tone: 'text-success-700 bg-success-50' }
      : { icon: XCircle, label: 'Sai', tone: 'text-danger-700 bg-danger-50' };
  const Icon = status.icon;

  return (
    <article className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start gap-3 p-5 text-left"
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${status.tone}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong>Câu {question.order + 1}</strong>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.tone}`}>
              {status.label}
            </span>
          </div>
          <div className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-600">
            <RichText nodes={question.content.stem} />
          </div>
        </div>
        {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </button>

      {expanded && (
        <div className="border-t border-neutral-100 p-5">
          <div className="text-sm leading-7 text-neutral-900">
            <RichText nodes={question.content.stem} />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <AnswerBox title="Câu trả lời của bạn" value={question.userAnswer} danger={!question.isCorrect} />
            <AnswerBox title="Đáp án đúng" value={question.correctAnswer} />
          </div>
          {question.content.solution && question.content.solution.length > 0 && (
            <div className="mt-4 rounded-xl bg-blue-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Lời giải</p>
              <div className="mt-2 text-sm leading-7 text-blue-950">
                <RichText nodes={question.content.solution} />
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              {(question.timeSpentMs / 1000).toFixed(1)} giây
            </span>
            <span>{question.pointsEarned}/{question.points} điểm</span>
            {question.tags.map((tag) => (
              <span key={tag.id} className="rounded-full bg-neutral-100 px-2 py-1">{tag.name}</span>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function AnswerBox({
  title,
  value,
  danger,
}: {
  title: string;
  value: Record<string, unknown> | null;
  danger?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${danger ? 'border-danger-200 bg-danger-50' : 'border-success-100 bg-success-50'}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{title}</p>
      <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm text-neutral-800">
        {value ? formatAnswer(value) : 'Không trả lời'}
      </pre>
    </div>
  );
}

function formatAnswer(value: Record<string, unknown>) {
  if (typeof value.selectedOptionId === 'string') return value.selectedOptionId;
  if (Array.isArray(value.selectedOptionIds)) return value.selectedOptionIds.join(', ');
  if (Array.isArray(value.answers)) {
    return value.answers
      .map((item) => {
        const row = item as { statementId?: string; value?: boolean };
        return `${row.statementId}: ${row.value ? 'Đúng' : 'Sai'}`;
      })
      .join(' · ');
  }
  if (Array.isArray(value.slots)) {
    return value.slots
      .map((item) => {
        const row = item as { slotId?: string; itemId?: string };
        return `${row.slotId}: ${row.itemId}`;
      })
      .join(' · ');
  }
  if (Array.isArray(value.blanks)) {
    return value.blanks
      .map((item) => {
        const row = item as { blankId?: string; value?: unknown };
        return `${row.blankId}: ${String(row.value ?? '')}`;
      })
      .join(' · ');
  }
  return JSON.stringify(value);
}

function matchesFilter(question: ReviewQuestion, filter: Filter) {
  if (filter === 'ALL') return true;
  if (filter === 'SKIPPED') return question.userAnswer === null;
  if (filter === 'CORRECT') return question.isCorrect === true;
  return question.userAnswer !== null && question.isCorrect === false;
}

function filterLabel(filter: Filter) {
  return {
    ALL: 'Tất cả',
    WRONG: 'Chỉ câu sai',
    SKIPPED: 'Bỏ trống',
    CORRECT: 'Câu đúng',
  }[filter];
}
