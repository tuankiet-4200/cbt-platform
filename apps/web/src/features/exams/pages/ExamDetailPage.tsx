import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock3,
  FlaskConical,
  GraduationCap,
  Dumbbell,
  KeyRound,
  Loader2,
  Sigma,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { createOrResumeAttempt } from '@/features/exam/api/sessions.api';
import { RetakeOptions } from '@/features/exam/components/RetakeOptions';
import { getAvailableExamSections } from '@/features/exam/lib/exam-sections';
import { getAvailableExam } from '../api/exams.api';

export default function ExamDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const examQuery = useQuery({
    queryKey: ['user', 'exams', id],
    queryFn: () => getAvailableExam(id),
    enabled: Boolean(id),
  });
  const startMutation = useMutation({
    mutationFn: () => createOrResumeAttempt(id),
    onSuccess: (attempt) => navigate(`/exam/attempt/${attempt.id}`),
  });

  const resumeAttempt = async (attemptId: string) => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // The session page will show a user-action prompt if fullscreen is denied.
    }
    navigate(`/exam/attempt/${attemptId}`);
  };

  if (examQuery.isLoading) {
    return (
      <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-neutral-500">
        <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
        Đang tải thông tin đề thi...
      </div>
    );
  }

  if (examQuery.isError || !examQuery.data) {
    return (
      <div className="card flex min-h-80 flex-col items-center justify-center px-6 text-center">
        <BookOpen className="h-10 w-10 text-neutral-400" />
        <h1 className="mt-4 text-xl font-bold text-neutral-900">Không thể mở đề thi</h1>
        <p className="mt-2 max-w-md text-sm text-neutral-500">
          {getApiErrorMessage(examQuery.error, 'Đề chưa được phát hành hoặc tài khoản của bạn chưa có quyền truy cập.')}
        </p>
        <Link to="/exams" className="btn btn-secondary btn-md mt-5">
          <ArrowLeft className="h-4 w-4" />
          Quay lại thư viện
        </Link>
      </div>
    );
  }

  const exam = examQuery.data;
  const isInProgress = exam.latestAttempt?.status === 'IN_PROGRESS';
  const isCompleted = ['SUBMITTED', 'GRADED'].includes(
    exam.latestAttempt?.status ?? '',
  );
  const availableSections = getAvailableExamSections(exam.counts);

  return (
    <div className="space-y-6">
      <Link to="/exams" className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" />
        Thư viện đề thi
      </Link>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#071229] via-[#13294f] to-primary-950 px-6 py-8 text-white shadow-xl md:px-10">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-primary-100">
                {exam.accessType === 'PUBLIC' ? 'Đề công khai' : 'Đề đã mở khóa'}
              </span>
              {isInProgress && <span className="rounded-full bg-warning-500/20 px-3 py-1 text-xs font-semibold text-warning-100">Đang làm bài</span>}
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight md:text-4xl">{exam.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-300 md:text-base">
              {exam.description || 'Đề thi mô phỏng theo cấu trúc TSA HUST.'}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <OverviewPill icon={Clock3} value={`${exam.durationMins} phút`} />
              <OverviewPill icon={GraduationCap} value={`${exam.counts.totalQuestions} câu hỏi`} />
              <OverviewPill icon={CheckCircle2} value={`${exam.totalPoints} điểm`} />
              <OverviewPill
                icon={exam.accessType === 'PUBLIC' ? BookOpen : KeyRound}
                value={exam.accessType === 'PUBLIC' ? 'Truy cập tự do' : 'Đã xác thực quyền'}
              />
            </div>
          </div>
          <aside className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-200">Trạng thái đề thi</p>
            <h2 className="mt-2 text-xl font-bold">
              {isInProgress ? 'Tiếp tục lượt thi' : isCompleted ? 'Sẵn sàng làm lại' : 'Sẵn sàng bắt đầu'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-300">
              {isInProgress ? 'Tiến độ của bạn đã được lưu.' : isCompleted ? 'Tạo một lượt thi mới với toàn bộ nội dung đề.' : 'Thời gian bắt đầu tính khi bạn vào phần thi đầu tiên.'}
            </p>
            {isInProgress && exam.latestAttempt ? (
              <button
                type="button"
                className="btn btn-primary btn-lg mt-5 w-full"
                onClick={() => void resumeAttempt(exam.latestAttempt!.id)}
              >
                Tiếp tục làm bài
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-lg mt-5 w-full" disabled={startMutation.isPending} onClick={() => startMutation.mutate()}>
                {startMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isCompleted ? 'Làm lại đề' : 'Bắt đầu làm bài'}
              </button>
            )}
            <Link
              to={`/practice/exams/${exam.id}`}
              className="btn btn-secondary btn-lg mt-3 w-full border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              <Dumbbell className="h-4 w-4" />
              Luyện tập đề này
            </Link>
            {startMutation.isError && <p className="mt-3 text-center text-xs text-danger-200">{getApiErrorMessage(startMutation.error, 'Không thể tạo lượt thi.')}</p>}
          </aside>
        </div>
      </section>

      <section className={`grid gap-5 ${
        availableSections.length === 3
          ? 'lg:grid-cols-3'
          : availableSections.length === 2
            ? 'lg:grid-cols-2'
            : ''
      }`}>
        {exam.counts.mathQuestions > 0 && <SectionCard
          icon={Sigma}
          label="Phần 1"
          title="Tư duy Toán học"
          description="Câu hỏi độc lập, tập trung vào khả năng lập luận và giải quyết vấn đề."
          questions={exam.counts.mathQuestions}
          tone="primary"
        />}
        {exam.counts.readingQuestions > 0 && <SectionCard
          icon={BookOpen}
          label={`${exam.counts.readingBundles} bài đọc`}
          title="Tư duy Đọc hiểu"
          description="Đọc văn bản, phân tích thông tin và trả lời câu hỏi theo từng bài."
          questions={exam.counts.readingQuestions}
          tone="accent"
        />}
        {exam.counts.scienceQuestions > 0 && <SectionCard
          icon={FlaskConical}
          label={`${exam.counts.scienceBundles} chủ đề`}
          title="Tư duy Khoa học"
          description="Phân tích dữ liệu và vận dụng kiến thức khoa học trong ngữ cảnh thực tế."
          questions={exam.counts.scienceQuestions}
          tone="success"
        />}
      </section>

      <section className={`grid gap-6 ${isCompleted && availableSections.length > 1 ? 'xl:grid-cols-[minmax(0,1fr)_22rem]' : ''}`}>
        <article className="card p-6">
          <h2 className="text-lg font-bold text-neutral-900">Hướng dẫn làm bài</h2>
          {exam.instructions ? (
            <div className="prose prose-sm mt-4 max-w-none text-neutral-600">
              <ReactMarkdown>{exam.instructions}</ReactMarkdown>
            </div>
          ) : (
            <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-600">
              <Instruction>Tổng thời gian làm bài là {exam.durationMins} phút.</Instruction>
              <Instruction>Đọc kỹ yêu cầu và kiểm tra câu trả lời trước khi chuyển phần.</Instruction>
              <Instruction>Thời gian được tính theo máy chủ và không dừng khi tải lại trang.</Instruction>
              <Instruction>Chỉ nộp bài khi bạn đã kiểm tra đầy đủ các phần thi đã chọn.</Instruction>
            </ul>
          )}
        </article>

        {isCompleted && availableSections.length > 1 && (
          <aside className="card p-6">
            <p className="text-sm font-semibold text-primary-700">Luyện tập theo phần</p>
            <h2 className="mt-2 text-xl font-bold text-neutral-900">Chọn nội dung cần luyện</h2>
            <p className="mb-4 mt-2 text-sm leading-6 text-neutral-500">Nếu không muốn làm lại toàn bộ đề, bạn có thể chọn riêng một phần.</p>
            <RetakeOptions examId={exam.id} availableSections={availableSections} sectionsOnly />
          </aside>
        )}
      </section>
    </div>
  );
}

function OverviewPill({ icon: Icon, value }: { icon: typeof Clock3; value: string }) {
  return (
    <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3.5 py-2 text-sm text-neutral-200">
      <Icon className="h-4 w-4 text-primary-300" />
      {value}
    </span>
  );
}

function SectionCard({
  icon: Icon,
  label,
  title,
  description,
  questions,
  tone,
}: {
  icon: typeof Sigma;
  label: string;
  title: string;
  description: string;
  questions: number;
  tone: 'primary' | 'accent' | 'success';
}) {
  const tones = {
    primary: 'bg-primary-50 text-primary-700',
    accent: 'bg-accent-50 text-accent-700',
    success: 'bg-success-50 text-success-700',
  };

  return (
    <article className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-2xl font-extrabold text-neutral-900">{questions}</span>
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
      <h2 className="mt-1 font-bold text-neutral-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-neutral-500">{description}</p>
    </article>
  );
}

function Instruction({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-success-600" />
      <span>{children}</span>
    </li>
  );
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (message) return message;
  }
  return fallback;
}
