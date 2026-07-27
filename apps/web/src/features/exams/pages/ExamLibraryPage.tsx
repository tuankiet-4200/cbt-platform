import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  GraduationCap,
  KeyRound,
  Loader2,
  Search,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { cn } from '@/lib/utils';
import {
  listAvailableExams,
  unlockExam,
  type UserExam,
} from '../api/exams.api';

type AccessFilter = 'ALL' | 'PUBLIC' | 'UNLOCKED';

export default function ExamLibraryPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('ALL');
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

  const exams = useMemo(() => examsQuery.data ?? [], [examsQuery.data]);
  const filteredExams = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase('vi-VN');
    return exams.filter((exam) => {
      const matchesSearch =
        !normalizedSearch ||
        exam.title.toLocaleLowerCase('vi-VN').includes(normalizedSearch) ||
        exam.description?.toLocaleLowerCase('vi-VN').includes(normalizedSearch);
      const matchesAccess =
        accessFilter === 'ALL' ||
        (accessFilter === 'PUBLIC' && exam.accessType === 'PUBLIC') ||
        (accessFilter === 'UNLOCKED' && exam.accessType === 'LOCKED');
      return matchesSearch && matchesAccess;
    });
  }, [accessFilter, exams, searchTerm]);

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
                value={exams.filter((exam) => exam.latestSession?.status === 'GRADED').length}
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

      <section>
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary-700">Thư viện của bạn</p>
            <h2 className="mt-1 text-2xl font-bold text-neutral-900">Chọn đề để luyện tập</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Đề công khai và các đề bạn đã mở khóa sẽ xuất hiện tại đây.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="input h-10 pl-9"
                placeholder="Tìm kiếm đề thi"
              />
            </label>
            <div className="grid grid-cols-3 rounded-lg border border-neutral-200 bg-white p-1">
              {([
                ['ALL', 'Tất cả'],
                ['PUBLIC', 'Công khai'],
                ['UNLOCKED', 'Đã mở'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAccessFilter(value)}
                  className={cn(
                    'h-8 rounded-md px-3 text-xs font-semibold transition',
                    accessFilter === value
                      ? 'bg-primary-600 text-white'
                      : 'text-neutral-600 hover:bg-neutral-100',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {examsQuery.isError && (
          <div className="mt-5 rounded-xl border border-danger-100 bg-danger-50 px-4 py-4 text-sm text-danger-700">
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
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => <SkeletonCard key={index} className="h-72" />)}
          </div>
        )}

        {!examsQuery.isLoading && !examsQuery.isError && filteredExams.length > 0 && (
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredExams.map((exam) => <ExamCard key={exam.id} exam={exam} />)}
          </div>
        )}

        {!examsQuery.isLoading && !examsQuery.isError && filteredExams.length === 0 && (
          <div className="card mt-5 flex min-h-72 flex-col items-center justify-center px-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500">
              <BookOpen className="h-7 w-7" />
            </span>
            <h3 className="mt-4 font-bold text-neutral-900">
              {exams.length === 0 ? 'Chưa có đề thi khả dụng' : 'Không tìm thấy đề phù hợp'}
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
              {exams.length === 0
                ? 'Nhập mã truy cập phía trên để mở khóa đề mới, hoặc quay lại khi có đề công khai được phát hành.'
                : 'Thử thay đổi từ khóa hoặc bộ lọc quyền truy cập.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function ExamCard({ exam }: { exam: UserExam }) {
  const isInProgress = exam.latestSession?.status === 'IN_PROGRESS';

  return (
    <article className="group relative flex min-h-72 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-card transition duration-200 hover:-translate-y-1 hover:border-primary-200 hover:shadow-soft">
      <div className="h-1.5 bg-gradient-to-r from-primary-600 via-primary-500 to-accent-500" />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <span className={cn('badge', exam.accessType === 'PUBLIC' ? 'badge-success' : 'badge-primary')}>
            {exam.accessType === 'PUBLIC' ? 'Công khai' : 'Đã mở khóa'}
          </span>
          {isInProgress && <span className="badge badge-warning">Đang làm</span>}
        </div>
        <h3 className="mt-4 text-lg font-bold leading-snug text-neutral-900 transition group-hover:text-primary-700">
          {exam.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-500">
          {exam.description || 'Đề thi mô phỏng TSA với đầy đủ ba phần Toán, Đọc hiểu và Khoa học.'}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <SectionCount label="Toán" value={exam.counts.mathQuestions} tone="primary" />
          <SectionCount label="Đọc hiểu" value={exam.counts.readingQuestions} tone="accent" />
          <SectionCount label="Khoa học" value={exam.counts.scienceQuestions} tone="success" />
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-4 text-sm text-neutral-500">
          <span className="flex items-center gap-1.5">
            <Clock3 className="h-4 w-4" />
            {exam.durationMins} phút
          </span>
          <span className="flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4" />
            {exam.counts.totalQuestions} câu
          </span>
        </div>

        <Link
          to={`/exams/${exam.id}`}
          className="btn btn-secondary btn-md mt-4 w-full group-hover:border-primary-300 group-hover:text-primary-700"
        >
          Xem thông tin đề
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
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

function SectionCount({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'primary' | 'accent' | 'success';
}) {
  const toneClasses = {
    primary: 'bg-primary-50 text-primary-700',
    accent: 'bg-accent-50 text-accent-700',
    success: 'bg-success-50 text-success-700',
  };

  return (
    <div className={cn('rounded-xl px-2 py-3 text-center', toneClasses[tone])}>
      <p className="text-lg font-extrabold">{value}</p>
      <p className="mt-0.5 text-[0.68rem] font-semibold">{label}</p>
    </div>
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
