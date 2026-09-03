import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Menu, MinusCircle, X, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { QuestionRenderer } from '@/features/exam/components/QuestionRenderer';
import { RichText } from '@/features/exam/components/RichText';
import type { ExamSectionType, SessionQuestion } from '@/features/exam/api/sessions.api';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { cn } from '@/lib/utils';
import { getAnswerReview, getExamResult, type ReviewBundle, type ReviewQuestion } from '../api/results.api';

const SECTIONS: Array<{ value: ExamSectionType; label: string }> = [
  { value: 'MATH', label: 'Tư duy Toán học' },
  { value: 'READING', label: 'Tư duy Đọc hiểu' },
  { value: 'SCIENCE', label: 'Khoa học' },
];

export default function ResultReviewPage() {
  const { attemptId = '' } = useParams();
  const candidateName = useAuthStore((state) => state.user?.displayName ?? 'Học viên');
  const [section, setSection] = useState<ExamSectionType | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const resultQuery = useQuery({ queryKey: ['exam-result', attemptId], queryFn: () => getExamResult(attemptId), enabled: Boolean(attemptId) });
  const selectedSections = useMemo(() => resultQuery.data?.selectedSections ?? [], [resultQuery.data?.selectedSections]);

  useEffect(() => {
    if (selectedSections.length > 0 && (!section || !selectedSections.includes(section))) setSection(selectedSections[0]);
  }, [section, selectedSections]);

  const reviewQuery = useQuery({
    queryKey: ['answer-review-full', attemptId, section],
    queryFn: () => getAnswerReview(attemptId, section!, 1, 100),
    enabled: Boolean(attemptId && section),
  });
  const bundles = useMemo(() => normalizeBundles(reviewQuery.data?.questions ?? [], reviewQuery.data?.bundles ?? [], section), [reviewQuery.data, section]);
  const flattened = useMemo(() => bundles.flatMap((bundle) => bundle.questions.map((question) => ({ bundle, question }))), [bundles]);
  const safeIndex = Math.min(currentIndex, Math.max(0, flattened.length - 1));
  const active = flattened[safeIndex];

  useEffect(() => setCurrentIndex(0), [section]);

  if (resultQuery.isLoading || reviewQuery.isLoading || !section) return <ReviewMessage message="Đang tải chi tiết bài làm..." />;
  if (resultQuery.isError || reviewQuery.isError || !reviewQuery.data || !active) return <ReviewMessage message="Không thể tải bài làm." attemptId={attemptId} />;

  const goTo = (index: number) => setCurrentIndex(Math.max(0, Math.min(index, flattened.length - 1)));
  const isTwoColumn = section !== 'MATH';

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#f6f6f6]">
      <header className="flex h-16 shrink-0 items-center justify-between border-t-2 border-neutral-900 bg-white px-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <span className="text-4xl font-black tracking-tighter text-primary-700">TSA</span>
          <h1 className="truncate text-sm font-bold text-neutral-900 md:text-base">{reviewQuery.data.exam.title} - {SECTIONS.find((item) => item.value === section)?.label}</h1>
          <span className="hidden rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600 md:inline">Chế độ xem lại</span>
        </div>
        <button type="button" onClick={() => setSidebarOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 lg:hidden" aria-label="Mở danh sách câu hỏi"><Menu className="h-5 w-5" /></button>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_25rem]">
        <main className="min-h-0 overflow-hidden p-4">
          {isTwoColumn ? (
            <div className="grid h-full min-h-0 gap-2 lg:grid-cols-2">
              <section className="overflow-y-auto rounded-lg bg-white p-5 text-sm leading-7 shadow-sm">
                <h2 className="mb-4 text-center font-bold text-neutral-800">{active.bundle.title ?? 'Bài đọc'}</h2>
                <RichText nodes={active.bundle.content} />
              </section>
              <section className="overflow-y-auto rounded-lg bg-white shadow-sm">
                {active.bundle.questions.map((question) => {
                  const index = flattened.findIndex((item) => item.question.id === question.id);
                  return <ReviewQuestionCard key={question.id} question={question} number={index + 1} active={index === safeIndex} shuffleSeed={attemptId} onSelect={() => goTo(index)} />;
                })}
              </section>
            </div>
          ) : (
            <section className="h-full overflow-y-auto rounded-lg bg-white p-5 shadow-sm">
              <ReviewQuestionCard question={active.question} number={safeIndex + 1} active shuffleSeed={attemptId} />
            </section>
          )}
        </main>

        <ReviewSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} candidateName={candidateName} section={section} selectedSections={selectedSections} questions={flattened.map((item) => item.question)} currentIndex={safeIndex} onSection={setSection} onGoTo={(index) => { goTo(index); setSidebarOpen(false); }} attemptId={attemptId} />
      </div>

      <footer className="flex h-16 shrink-0 items-center justify-between border-t border-neutral-200 bg-white px-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => goTo(safeIndex - 1)} disabled={safeIndex === 0} className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 disabled:opacity-40" aria-label="Câu trước"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => goTo(safeIndex + 1)} disabled={safeIndex === flattened.length - 1} className="flex h-10 items-center gap-2 rounded-md bg-[#17386d] px-5 text-sm font-semibold text-white disabled:opacity-40">Câu tiếp<ChevronRight className="h-4 w-4" /></button>
        </div>
        <StatusLabel question={active.question} />
      </footer>
    </div>
  );
}

function ReviewQuestionCard({ question, number, active, shuffleSeed, onSelect }: { question: ReviewQuestion; number: number; active: boolean; shuffleSeed: string; onSelect?: () => void }) {
  return (
    <article onClick={onSelect} className={cn('border-b border-neutral-100 p-5 transition', active && onSelect && 'bg-blue-50/30')}>
      <div className="flex items-start gap-3">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold', question.isCorrect ? 'bg-success-50 text-success-700' : question.userAnswer ? 'bg-danger-50 text-danger-700' : 'bg-neutral-100 text-neutral-600')}>{number}</span>
        <div className="min-w-0 flex-1">
          <QuestionRenderer question={toSessionQuestion(question)} answer={question.userAnswer ?? undefined} onAnswer={() => undefined} shuffleSeed={shuffleSeed} readOnly />
          <div className={cn('mt-5 rounded-lg border p-4', !question.userAnswer ? 'border-neutral-200 bg-neutral-50' : question.isCorrect ? 'border-success-100 bg-success-50' : 'border-danger-100 bg-danger-50')}>
            <div className="flex items-center justify-between gap-3"><StatusLabel question={question} /><span className="text-xs font-semibold text-neutral-500">{question.pointsEarned}/{question.points} điểm</span></div>
            {!question.isCorrect && <p className="mt-3 text-sm text-neutral-700"><strong>Đáp án đúng:</strong> {formatAnswer(question.correctAnswer)}</p>}
            {question.content.solution?.length ? <div className="mt-3 border-t border-neutral-200/70 pt-3 text-sm leading-7"><strong>Lời giải: </strong><RichText nodes={question.content.solution} /></div> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function ReviewSidebar({ open, onClose, candidateName, section, selectedSections, questions, currentIndex, onSection, onGoTo, attemptId }: { open: boolean; onClose: () => void; candidateName: string; section: ExamSectionType; selectedSections: ExamSectionType[]; questions: ReviewQuestion[]; currentIndex: number; onSection: (section: ExamSectionType) => void; onGoTo: (index: number) => void; attemptId: string }) {
  return <>
    {open && <button type="button" className="fixed inset-0 z-30 bg-neutral-950/50 lg:hidden" onClick={onClose} aria-label="Đóng menu" />}
    <aside className={cn('fixed inset-y-0 right-0 z-40 flex w-[min(25rem,92vw)] flex-col bg-white p-5 shadow-2xl transition-transform lg:static lg:z-auto lg:w-auto lg:translate-x-0 lg:border-l lg:border-neutral-200 lg:shadow-none', open ? 'translate-x-0' : 'translate-x-full')}>
      <button type="button" onClick={onClose} className="absolute right-4 top-4 lg:hidden" aria-label="Đóng menu"><X className="h-5 w-5" /></button>
      <h2 className="font-semibold text-neutral-800">Thông tin thí sinh</h2>
      <div className="mt-3 flex justify-between text-sm text-neutral-500"><span>Họ tên</span><span className="font-medium text-neutral-700">{candidateName}</span></div>
      <div className="mt-6 rounded-md border border-neutral-200 px-3 py-3 text-center"><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Xem lại bài làm</p><p className="mt-1 text-sm font-bold text-[#17386d]">Không giới hạn thời gian</p></div>
      {selectedSections.length > 1 && <div className="mt-5 grid grid-cols-3 gap-1 rounded-lg bg-neutral-100 p-1">{SECTIONS.filter((item) => selectedSections.includes(item.value)).map((item) => <button key={item.value} type="button" onClick={() => onSection(item.value)} className={cn('rounded-md px-2 py-2 text-xs font-semibold', section === item.value ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500')}>{item.value === 'MATH' ? 'Toán' : item.value === 'READING' ? 'Đọc hiểu' : 'Khoa học'}</button>)}</div>}
      <div className="mt-6 flex items-center justify-between"><h3 className="text-sm font-semibold text-neutral-800">Danh sách câu hỏi</h3><span className="text-xs text-neutral-500">{questions.filter((q) => q.isCorrect).length}/{questions.length} đúng</span></div>
      <div className="mt-3 grid grid-cols-5 gap-2 overflow-y-auto pb-3">{questions.map((question, index) => <button key={question.id} type="button" onClick={() => onGoTo(index)} className={cn('relative h-10 rounded-md border text-sm font-bold transition', question.isCorrect ? 'border-success-300 bg-success-50 text-success-700' : question.userAnswer ? 'border-danger-300 bg-danger-50 text-danger-700' : 'border-neutral-300 bg-neutral-100 text-neutral-600', index === currentIndex && 'ring-2 ring-[#17386d] ring-offset-1')}>{index + 1}</button>)}</div>
      <div className="mt-auto space-y-3 border-t border-neutral-100 pt-4"><div className="flex flex-wrap gap-3 text-xs text-neutral-500"><span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-success-100" />Đúng</span><span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-danger-100" />Sai</span><span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-neutral-200" />Bỏ trống</span></div><Link to={`/results/${attemptId}`} className="btn btn-secondary w-full"><ArrowLeft className="h-4 w-4" />Kết quả tổng quan</Link></div>
    </aside>
  </>;
}

function StatusLabel({ question }: { question: ReviewQuestion }) {
  if (!question.userAnswer) return <span className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-600"><MinusCircle className="h-4 w-4" />Bỏ trống</span>;
  return question.isCorrect ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-success-700"><CheckCircle2 className="h-4 w-4" />Trả lời đúng</span> : <span className="inline-flex items-center gap-1 text-sm font-semibold text-danger-700"><XCircle className="h-4 w-4" />Trả lời sai</span>;
}

function normalizeBundles(questions: ReviewQuestion[], bundles: ReviewBundle[], section: ExamSectionType | null): ReviewBundle[] {
  return section === 'MATH' ? [{ id: 'math', title: null, content: [], order: 0, questions }] : bundles;
}

function toSessionQuestion(question: ReviewQuestion): SessionQuestion {
  return { id: question.id, type: question.type, expectedTimeSecs: question.expectedTimeSecs, points: question.points, content: { _version: 2, type: question.type, stem: question.content.stem, payload: question.content.payload } };
}

function formatAnswer(value: Record<string, unknown>) {
  if (typeof value.selectedOptionId === 'string') return value.selectedOptionId;
  if (Array.isArray(value.selectedOptionIds)) return value.selectedOptionIds.join(', ');
  if (Array.isArray(value.answers)) return value.answers.map((item) => { const row = item as { statementId?: string; value?: boolean }; return `${row.statementId}: ${row.value ? 'Đúng' : 'Sai'}`; }).join(' · ');
  if (Array.isArray(value.blanks)) return value.blanks.map((item) => { const row = item as { blankId?: string; value?: unknown }; return `${row.blankId}: ${String(row.value ?? '')}`; }).join(' · ');
  if (Array.isArray(value.slots)) return value.slots.map((item) => { const row = item as { slotId?: string; itemId?: string }; return `${row.slotId}: ${row.itemId}`; }).join(' · ');
  return JSON.stringify(value);
}

function ReviewMessage({ message, attemptId }: { message: string; attemptId?: string }) {
  return <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-neutral-50 text-neutral-600"><p>{message}</p>{attemptId && <Link to={`/results/${attemptId}`} className="btn btn-secondary">Quay lại kết quả</Link>}</div>;
}
