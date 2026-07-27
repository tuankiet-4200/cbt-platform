import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  KeyRound,
  Loader2,
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { createOrResumeAttempt } from '@/features/exam/api/sessions.api';
import {
  listAvailableExams,
  unlockExam,
  type UserExam,
} from '../api/exams.api';

export default function ExamLibraryPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockSuccess, setUnlockSuccess] = useState<string | null>(null);

  const examsQuery = useQuery({
    queryKey: ['user', 'exams'],
    queryFn: listAvailableExams,
  });

  const unlockMutation = useMutation({
    mutationFn: unlockExam,
    onSuccess: async (result) => {
      setUnlockError(null);
      setUnlockSuccess(
        result.alreadyUnlocked
          ? `Bạn đã mở khóa đề “${result.exam.title}” trước đó.`
          : `Đã mở khóa thành công đề “${result.exam.title}”.`,
      );
      setCode('');
      await queryClient.invalidateQueries({ queryKey: ['user', 'exams'] });
    },
    onError: (error) => {
      setUnlockSuccess(null);
      setUnlockError(getApiErrorMessage(error, 'Không thể mở khóa đề. Vui lòng kiểm tra lại mã.'));
    },
  });

  const exams = examsQuery.data ?? [];

  const handleUnlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedCode = normalizeAccessCode(code);
    if (normalizedCode.length !== 8) {
      setUnlockSuccess(null);
      setUnlockError('Mã truy cập phải gồm đúng 8 ký tự.');
      return;
    }
    setUnlockError(null);
    setUnlockSuccess(null);
    unlockMutation.mutate(normalizedCode);
  };

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-3xl bg-neutral-950 px-6 py-8 text-white shadow-xl md:px-8 lg:px-10">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary-500/25 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-accent-500/15 blur-3xl" />
        <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-primary-200">
              <Sparkles className="h-4 w-4" />
              Không gian luyện thi TSA
            </div>
            <h1 className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight md:text-4xl">
              Chào {user?.displayName ?? 'bạn'}, sẵn sàng chinh phục mục tiêu tiếp theo?
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-300 md:text-base">
              Luyện tập với đề mô phỏng đúng cấu trúc TSA, theo dõi tiến độ và làm chủ từng phần thi.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <HeroMetric icon={BookOpen} value={exams.length} label="đề khả dụng" />
              <HeroMetric
                icon={Trophy}
                value={exams.filter((exam) => ['SUBMITTED', 'GRADED'].includes(exam.latestAttempt?.status ?? '')).length}
                label="đề hoàn thành"
              />
            </div>
          </div>

          <form onSubmit={handleUnlock} className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500 text-white shadow-lg shadow-primary-950/30">
                <KeyRound className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-bold">Mở khóa đề mới</h2>
                <p className="text-xs text-neutral-300">Nhập mã 8 ký tự do quản trị viên cấp</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={code}
                onChange={(event) => {
                  setCode(normalizeAccessCode(event.target.value));
                  setUnlockError(null);
                  setUnlockSuccess(null);
                }}
                maxLength={8}
                autoComplete="off"
                spellCheck={false}
                aria-label="Mã truy cập đề thi"
                className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white px-4 py-3 font-mono text-sm font-bold uppercase tracking-[0.2em] text-neutral-900 outline-none transition placeholder:font-sans placeholder:font-normal placeholder:tracking-normal focus:border-primary-300 focus:ring-4 focus:ring-primary-500/20"
                placeholder="VD: TSA8K2M9"
              />
              <button
                type="submit"
                disabled={unlockMutation.isPending || code.length !== 8}
                className="btn btn-primary h-12 shrink-0 px-4"
              >
                {unlockMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                <span className="hidden sm:inline">Mở khóa</span>
              </button>
            </div>
            {unlockError && <p className="mt-3 text-sm text-primary-200">{unlockError}</p>}
            {unlockSuccess && (
              <p className="mt-3 flex items-start gap-2 text-sm text-success-100">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                {unlockSuccess}
              </p>
            )}
          </form>
        </div>
      </section>

      <section className="pb-4">
        <header className="flex flex-col gap-4 border-b border-neutral-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-neutral-900">
            Bài thi Đánh giá tư duy - TSA
          </h2>
          <button
            type="button"
            onClick={() => examsQuery.refetch()}
            disabled={examsQuery.isFetching}
            className="h-9 rounded-md border border-neutral-300 bg-white px-8 text-sm font-medium text-primary-600 transition hover:border-primary-300 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-64"
          >
            {examsQuery.isFetching ? 'Đang tải kỳ thi...' : 'Xem tất cả kỳ thi'}
          </button>
        </header>

        {examsQuery.isError && (
          <div className="mt-4 rounded-lg border border-danger-100 bg-danger-50 px-4 py-4 text-sm text-danger-700">
            {getApiErrorMessage(examsQuery.error, 'Không tải được danh sách đề thi.')}
            <button
              type="button"
              className="ml-2 font-semibold underline"
              onClick={() => examsQuery.refetch()}
            >
              Thử lại
            </button>
          </div>
        )}

        {examsQuery.isLoading && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => <SkeletonCard key={index} className="h-64" />)}
          </div>
        )}

        {!examsQuery.isLoading && !examsQuery.isError && exams.length > 0 && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {exams.map((exam) => <ExamCard key={exam.id} exam={exam} />)}
          </div>
        )}

        {!examsQuery.isLoading && !examsQuery.isError && exams.length === 0 && (
          <div className="card mt-4 flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500">
              <BookOpen className="h-7 w-7" />
            </span>
            <h3 className="mt-4 font-bold text-neutral-900">Chưa có đề thi khả dụng</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
              Nhập mã truy cập phía trên để mở khóa đề mới, hoặc quay lại khi có đề công khai được phát hành.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function ExamCard({ exam }: { exam: UserExam }) {
  const navigate = useNavigate();
  const isInProgress = exam.latestAttempt?.status === 'IN_PROGRESS';
  const isCompleted = ['SUBMITTED', 'GRADED'].includes(exam.latestAttempt?.status ?? '');
  const retakeMutation = useMutation({
    mutationFn: () => createOrResumeAttempt(exam.id),
    onSuccess: (attempt) => navigate(`/exam/attempt/${attempt.id}`),
  });

  return (
    <article className="overflow-hidden rounded-lg border border-neutral-100 bg-white shadow-soft">
      <header className="border-b border-neutral-100 px-6 py-5">
        <h3 className="text-base font-semibold leading-snug text-neutral-900">
          {exam.title}
        </h3>
      </header>

      <dl className="space-y-3 px-6 py-5 text-sm">
        <ExamInfoRow label="Hình thức thi">
          <span className="rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-500">
            Thi trực tuyến
          </span>
        </ExamInfoRow>
        <ExamInfoRow label="Thời lượng">
          <span className="font-medium text-neutral-900">{exam.durationMins} phút</span>
        </ExamInfoRow>
        <ExamInfoRow label="Cấu trúc">
          <span className="font-medium text-neutral-900">
            {exam.counts.totalQuestions} câu · 3 phần thi
          </span>
        </ExamInfoRow>
        <ExamInfoRow label="Tổng điểm">
          <span className="font-semibold text-neutral-900">{exam.totalPoints} điểm</span>
        </ExamInfoRow>
      </dl>

      <footer className="flex min-h-16 items-center justify-between gap-4 border-t border-neutral-100 px-6 py-4">
        <span className="text-sm font-medium text-primary-600">
          {isCompleted
            ? 'Đã hoàn thành'
            : exam.accessType === 'PUBLIC'
              ? 'Đề công khai'
              : 'Đã mở khóa'}
        </span>
        {isInProgress && exam.latestAttempt ? (
          <Link
            to={`/exam/attempt/${exam.latestAttempt.id}`}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-success-600 px-5 text-sm font-semibold text-white transition hover:bg-success-700"
          >
            Tiếp tục làm bài
          </Link>
        ) : isCompleted && exam.latestAttempt ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Link
              to={`/results/${exam.latestAttempt.id}`}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50"
            >
              Xem kết quả
            </Link>
            <button
              type="button"
              disabled={retakeMutation.isPending}
              onClick={() => retakeMutation.mutate()}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-success-600 px-4 text-sm font-semibold text-white transition hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {retakeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Thi lại
            </button>
          </div>
        ) : (
          <Link
            to={`/exams/${exam.id}`}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-success-600 px-5 text-sm font-semibold text-white transition hover:bg-success-700"
          >
            Xem thông tin
          </Link>
        )}
      </footer>
      {retakeMutation.isError && (
        <p className="border-t border-danger-100 bg-danger-50 px-6 py-3 text-right text-xs text-danger-700">
          {getApiErrorMessage(
            retakeMutation.error,
            'Không thể tạo lượt thi mới. Vui lòng thử lại.',
          )}
        </p>
      )}
    </article>
  );
}

function ExamInfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-4">
      <dt className="text-neutral-500">{label}:</dt>
      <dd className="flex justify-end text-right">{children}</dd>
    </div>
  );
}

function HeroMetric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof BookOpen;
  value: number;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-neutral-200">
      <Icon className="h-4 w-4 text-primary-300" />
      <strong className="text-white">{value}</strong>
      {label}
    </span>
  );
}

function normalizeAccessCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (message) return message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
