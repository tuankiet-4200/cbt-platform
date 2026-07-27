import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  FlaskConical,
  Loader2,
  RotateCcw,
  Sigma,
  Target,
  XCircle,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getExamResult, type SectionScore } from '../api/results.api';

const SECTION_META = {
  MATH: { label: 'Tư duy Toán học', icon: Sigma, tone: 'text-blue-700 bg-blue-50' },
  READING: { label: 'Tư duy Đọc hiểu', icon: BookOpen, tone: 'text-indigo-700 bg-indigo-50' },
  SCIENCE: { label: 'Khoa học', icon: FlaskConical, tone: 'text-emerald-700 bg-emerald-50' },
};

export default function ResultPage() {
  const { attemptId = '' } = useParams();
  const resultQuery = useQuery({
    queryKey: ['exam-result', attemptId],
    queryFn: () => getExamResult(attemptId),
    enabled: Boolean(attemptId),
    retry: 2,
  });

  if (resultQuery.isLoading) {
    return (
      <div className="flex min-h-96 items-center justify-center gap-3 text-neutral-500">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        Đang chấm bài và tổng hợp kết quả...
      </div>
    );
  }
  if (resultQuery.isError || !resultQuery.data) {
    return (
      <div className="card flex min-h-80 flex-col items-center justify-center p-8 text-center">
        <XCircle className="h-11 w-11 text-danger-500" />
        <h1 className="mt-4 text-xl font-bold">Chưa thể tải kết quả</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Hệ thống chưa hoàn tất chấm bài hoặc kết quả không tồn tại.
        </p>
        <button
          type="button"
          onClick={() => resultQuery.refetch()}
          className="btn btn-secondary mt-5"
        >
          <RotateCcw className="h-4 w-4" />
          Thử lại
        </button>
      </div>
    );
  }

  const result = resultQuery.data;
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-950 via-[#13294f] to-primary-950 p-7 text-white shadow-xl md:p-10">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-primary-200">Kết quả bài thi</p>
            <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">
              {result.exam.title}
            </h1>
            <div className="mt-6 flex flex-wrap gap-3">
              <Metric icon={CheckCircle2} value={`${result.correctCount} câu đúng`} />
              <Metric icon={XCircle} value={`${result.wrongCount} câu sai`} />
              <Metric icon={Clock3} value={formatDuration(result.durationSecs)} />
            </div>
          </div>
          <div className="flex aspect-square flex-col items-center justify-center rounded-full border-8 border-white/15 bg-white/10 text-center shadow-2xl backdrop-blur">
            <strong className="text-5xl font-black">{result.percentScore.toFixed(1)}%</strong>
            <span className="mt-2 text-sm text-neutral-300">
              {formatScore(result.totalScore)}/{formatScore(result.maxScore)} điểm
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {result.sectionScores.map((section) => (
          <SectionResultCard key={section.section} section={section} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="card p-6">
          <h2 className="font-bold text-neutral-900">Năng lực theo phần thi</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Tỷ lệ điểm đạt được trên từng trục năng lực TSA
          </p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                data={result.sectionScores.map((section) => ({
                  section: SECTION_META[section.section].label,
                  percent: section.maxScore
                    ? Number(((section.score / section.maxScore) * 100).toFixed(1))
                    : 0,
                }))}
              >
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="section" tick={{ fontSize: 12, fill: '#525252' }} />
                <Radar
                  dataKey="percent"
                  stroke="#dc2626"
                  fill="#dc2626"
                  fillOpacity={0.22}
                />
                <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Kết quả']} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card p-6">
          <h2 className="font-bold text-neutral-900">Kết quả theo chủ đề</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Tỷ lệ trả lời đúng ở các nhóm kiến thức xuất hiện trong đề
          </p>
          <div className="mt-4 h-72">
            {result.tagBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={result.tagBreakdown.slice(0, 8).map((tag) => ({
                    name: tag.tagName,
                    accuracy: tag.total ? Number(((tag.correct / tag.total) * 100).toFixed(1)) : 0,
                  }))}
                  margin={{ left: -18, right: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Độ chính xác']} />
                  <Bar dataKey="accuracy" fill="#2563eb" radius={[7, 7, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-neutral-400">
                Chưa có dữ liệu chủ đề
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="card p-6">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary-600" />
            <h2 className="font-bold text-neutral-900">Tổng quan bài làm</h2>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <SummaryBox label="Đúng" value={result.correctCount} tone="text-success-700 bg-success-50" />
            <SummaryBox label="Sai" value={result.wrongCount} tone="text-danger-700 bg-danger-50" />
            <SummaryBox label="Bỏ trống" value={result.skippedCount} tone="text-neutral-700 bg-neutral-100" />
          </div>
          {result.tagBreakdown.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold text-neutral-700">Theo chủ đề</h3>
              {result.tagBreakdown.slice(0, 8).map((tag) => (
                <div key={tag.tagId}>
                  <div className="flex justify-between text-xs text-neutral-500">
                    <span>{tag.tagName}</span>
                    <span>{tag.correct}/{tag.total}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-primary-500"
                      style={{ width: `${tag.total ? (tag.correct / tag.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <aside className="card flex flex-col p-6">
          <h2 className="font-bold text-neutral-900">Xem lại bài làm</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            Kiểm tra đáp án, lời giải và thời gian làm từng câu để cải thiện lần thi tiếp theo.
          </p>
          <Link
            to={`/results/${attemptId}/review`}
            className="btn btn-primary mt-6 w-full"
          >
            Xem chi tiết đáp án
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/exams" className="btn btn-secondary mt-3 w-full">
            Về thư viện đề thi
          </Link>
        </aside>
      </section>
    </div>
  );
}

function SectionResultCard({ section }: { section: SectionScore }) {
  const meta = SECTION_META[section.section];
  const Icon = meta.icon;
  const percent = section.maxScore ? (section.score / section.maxScore) * 100 : 0;
  return (
    <article className="card p-5">
      <div className="flex items-center justify-between">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${meta.tone}`}>
          <Icon className="h-5 w-5" />
        </span>
        <strong className="text-xl text-neutral-900">
          {formatScore(section.score)}/{formatScore(section.maxScore)}
        </strong>
      </div>
      <h2 className="mt-4 font-bold text-neutral-900">{meta.label}</h2>
      <p className="mt-1 text-sm text-neutral-500">
        {section.correct}/{section.total} câu đúng
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
      </div>
    </article>
  );
}

function Metric({ icon: Icon, value }: { icon: typeof Clock3; value: string }) {
  return (
    <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm">
      <Icon className="h-4 w-4 text-primary-300" />
      {value}
    </span>
  );
}

function SummaryBox({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-xl p-4 ${tone}`}>
      <strong className="text-2xl">{value}</strong>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide">{label}</p>
    </div>
  );
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0
    ? `${hours} giờ ${minutes} phút`
    : `${minutes}:${String(rest).padStart(2, '0')}`;
}
