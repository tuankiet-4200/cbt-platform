import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { QuestionRenderer } from '@/features/exam/components/QuestionRenderer';
import { RichText } from '@/features/exam/components/RichText';
import type {
  RichTextNode,
  SessionBundle,
  SessionQuestion,
} from '@/features/exam/api/sessions.api';
import {
  getExamPractice,
  getTagPractice,
  type PracticeSection,
} from '../api/exams.api';
import { cn } from '@/lib/utils';

interface FlatQuestion {
  section: PracticeSection;
  bundle?: SessionBundle;
  question: SessionQuestion;
}

export default function PracticePage() {
  const { examId, tagId } = useParams();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>({});
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const practiceQuery = useQuery({
    queryKey: ['practice', examId ? 'exam' : 'tag', examId ?? tagId],
    queryFn: () => examId ? getExamPractice(examId) : getTagPractice(tagId ?? ''),
    enabled: Boolean(examId || tagId),
    refetchOnWindowFocus: false,
  });
  const flattened = useMemo(
    () => flattenPractice(practiceQuery.data?.sections ?? []),
    [practiceQuery.data?.sections],
  );
  const safeIndex = Math.min(currentIndex, Math.max(0, flattened.length - 1));
  const active = flattened[safeIndex];

  if (practiceQuery.isLoading) {
    return <FullScreenMessage icon={Loader2} spin label="Đang chuẩn bị bài luyện..." />;
  }
  if (practiceQuery.isError || !practiceQuery.data) {
    return <FullScreenMessage icon={ArrowLeft} label="Không thể tải nội dung luyện tập." back />;
  }
  if (!active) {
    return <FullScreenMessage icon={ArrowLeft} label="Chủ đề này chưa có câu hỏi khả dụng." back />;
  }

  const practice = practiceQuery.data;
  const showAnswer = revealed.has(active.question.id);
  const goTo = (index: number) =>
    setCurrentIndex(Math.max(0, Math.min(index, flattened.length - 1)));

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-neutral-50">
      <header className="flex h-16 shrink-0 items-center justify-between border-t-2 border-neutral-900 bg-white px-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <span className="text-4xl font-black tracking-tighter text-primary-700">TSA</span>
          <div className="min-w-0">
            <h1 className="truncate font-bold text-neutral-900">{practice.title}</h1>
            <p className="text-xs font-semibold text-primary-700">Chế độ luyện tập · Không giới hạn thời gian</p>
          </div>
        </div>
        <Link to={examId ? `/exams/${examId}` : '/practice'} className="btn btn-secondary btn-sm">
          <ArrowLeft className="h-4 w-4" />
          Thoát luyện tập
        </Link>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-h-0 overflow-hidden p-4">
          <div className={cn(
            'grid h-full min-h-0 overflow-hidden rounded-xl bg-white shadow-sm',
            active.section.layout === 'TWO_COLUMN' && 'lg:grid-cols-2',
          )}>
            {active.section.layout === 'TWO_COLUMN' && (
              <section
                className="overflow-y-auto border-b border-neutral-200 p-6 leading-[1.8] lg:border-b-0 lg:border-r"
                style={{ fontSize: `${practice.contentFontSize}px` }}
              >
                {active.bundle?.title && <h2 className="mb-5 text-center font-bold">{active.bundle.title}</h2>}
                <RichText nodes={active.bundle?.content ?? []} />
              </section>
            )}
            <section className="overflow-y-auto p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-700">
                  {safeIndex + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <QuestionRenderer
                    question={active.question}
                    answer={answers[active.question.id]}
                    onAnswer={(answer) => setAnswers((current) => ({
                      ...current,
                      [active.question.id]: answer,
                    }))}
                    shuffleSeed={`practice:${practice.id}`}
                    fontSize={practice.contentFontSize}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-md mt-6"
                    onClick={() => setRevealed((current) => {
                      const next = new Set(current);
                      if (next.has(active.question.id)) next.delete(active.question.id);
                      else next.add(active.question.id);
                      return next;
                    })}
                  >
                    {showAnswer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showAnswer ? 'Ẩn đáp án' : 'Xem đáp án'}
                  </button>
                  {showAnswer && <AnswerPanel question={active.question} />}
                </div>
              </div>
            </section>
          </div>
        </main>

        <aside className="flex min-h-0 flex-col border-l border-neutral-200 bg-white p-5">
          <h2 className="font-bold text-neutral-900">Danh sách câu hỏi</h2>
          <p className="mt-1 text-sm text-neutral-500">{flattened.length} câu</p>
          <div className="mt-5 grid grid-cols-6 gap-2 overflow-y-auto pb-4">
            {flattened.map((item, index) => (
              <button
                key={`${item.question.id}:${index}`}
                type="button"
                onClick={() => goTo(index)}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-full text-xs font-bold transition',
                  index === safeIndex
                    ? 'bg-[#17386d] text-white ring-2 ring-primary-500 ring-offset-2'
                    : answers[item.question.id]
                      ? 'bg-blue-500 text-white'
                      : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200',
                )}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <div className="mt-auto rounded-lg bg-primary-50 p-4 text-sm leading-6 text-primary-800">
            <strong className="block">Mẹo luyện tập</strong>
            Tự trả lời trước, sau đó mở đáp án của từng câu để đối chiếu.
          </div>
        </aside>
      </div>

      <footer className="flex h-16 shrink-0 items-center justify-between border-t border-neutral-200 bg-white px-4">
        <button type="button" className="btn btn-secondary btn-md" disabled={safeIndex === 0} onClick={() => goTo(safeIndex - 1)}>
          <ChevronLeft className="h-4 w-4" /> Câu trước
        </button>
        <span className="text-sm font-semibold text-neutral-500">{safeIndex + 1}/{flattened.length}</span>
        <button type="button" className="btn btn-primary btn-md" disabled={safeIndex === flattened.length - 1} onClick={() => goTo(safeIndex + 1)}>
          Câu tiếp <ChevronRight className="h-4 w-4" />
        </button>
      </footer>
    </div>
  );
}

function flattenPractice(sections: PracticeSection[]): FlatQuestion[] {
  return sections.flatMap((section) =>
    section.layout === 'SINGLE_COLUMN'
      ? section.questions.map((question) => ({ section, question }))
      : section.bundles.flatMap((bundle) =>
          bundle.questions.map((question) => ({ section, bundle, question })),
        ),
  );
}

function AnswerPanel({ question }: { question: SessionQuestion }) {
  const payload = question.content.payload;
  const rows: Array<{ label: string; content?: RichTextNode[]; value?: string }> = [];
  if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
    const options = (payload.options ?? []) as Array<{ id: string; content: RichTextNode[]; isCorrect?: boolean }>;
    options.filter((option) => option.isCorrect).forEach((option) => rows.push({ label: option.id, content: option.content }));
  } else if (question.type === 'TRUE_FALSE_MATRIX') {
    const statements = (payload.statements ?? []) as Array<{ id: string; isTrue?: boolean }>;
    statements.forEach((statement) => rows.push({ label: statement.id, value: statement.isTrue ? 'Đúng' : 'Sai' }));
  } else if (question.type === 'DRAG_DROP') {
    const items = (payload.items ?? []) as Array<{ id: string; content: RichTextNode[] }>;
    const slots = (payload.slots ?? []) as Array<{ id: string; correctItemId?: string }>;
    slots.forEach((slot) => rows.push({
      label: slot.id,
      content: items.find((item) => item.id === slot.correctItemId)?.content,
    }));
  } else {
    const blanks = (payload.blanks ?? []) as Array<{ id: string; correctValue?: string }>;
    blanks.forEach((blank) => rows.push({ label: blank.id, value: blank.correctValue ?? '' }));
  }

  return (
    <section className="mt-4 rounded-xl border border-success-200 bg-success-50 p-5">
      <div className="flex items-center gap-2 font-bold text-success-800">
        <CheckCircle2 className="h-5 w-5" /> Đáp án đúng
      </div>
      <div className="mt-3 space-y-2 text-neutral-800">
        {rows.map((row, index) => (
          <div key={`${row.label}:${index}`} className="flex gap-2">
            <strong>{row.label}:</strong>
            {row.content ? <RichText nodes={row.content} /> : <span>{row.value}</span>}
          </div>
        ))}
      </div>
      {question.content.solution?.length ? (
        <div className="mt-4 border-t border-success-200 pt-4 leading-7">
          <strong className="mb-2 block">Lời giải</strong>
          <RichText nodes={question.content.solution} />
        </div>
      ) : null}
    </section>
  );
}

function FullScreenMessage({
  icon: Icon,
  label,
  spin,
  back,
}: {
  icon: typeof Loader2;
  label: string;
  spin?: boolean;
  back?: boolean;
}) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-neutral-50 text-neutral-600">
      <Icon className={cn('h-8 w-8 text-primary-600', spin && 'animate-spin')} />
      <p>{label}</p>
      {back && <Link to="/practice" className="btn btn-secondary btn-md">Quay lại chủ đề</Link>}
    </div>
  );
}
