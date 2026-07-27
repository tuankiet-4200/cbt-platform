import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  FlaskConical,
  History,
  Loader2,
  Medal,
  RotateCcw,
  Sigma,
  Target,
  Trophy,
  XCircle,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  getExamHistory,
  getLeaderboard,
  type ExamHistory,
  type LeaderboardEntry,
} from '@/features/analytics/api/analytics.api';
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

      <ExamAttemptInsights
        examId={result.exam.id}
        currentAttemptId={attemptId}
      />

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

function ExamAttemptInsights({
  examId,
  currentAttemptId,
}: {
  examId: string;
  currentAttemptId: string;
}) {
  const [page, setPage] = useState(1);
  const historyQuery = useQuery({
    queryKey: ['analytics', 'history', examId, page],
    queryFn: () => getExamHistory(examId, page),
  });
  const progressQuery = useQuery({
    queryKey: ['analytics', 'history', examId, 1],
    queryFn: () => getExamHistory(examId, 1),
  });
  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard', examId],
    queryFn: () => getLeaderboard(examId),
  });
  const history = historyQuery.data;
  const progressData = [...(progressQuery.data?.data ?? [])]
    .reverse()
    .map((attempt) => ({
      name: `Lần ${attempt.attemptNumber}`,
      score: Number(attempt.result.percentScore.toFixed(1)),
    }));

  return (
    <section className="space-y-5">
      <article className="card p-6">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary-600" />
          <div>
            <h2 className="font-bold text-neutral-900">
              Tiến bộ qua các lần thi
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              So sánh tối đa 10 lần làm gần nhất của riêng đề thi này
            </p>
          </div>
        </div>
        <div className="mt-5 h-72">
          {progressQuery.isLoading ? (
            <ChartLoading />
          ) : progressData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progressData} margin={{ left: -20, right: 14 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => [
                    `${Number(value).toFixed(1)}%`,
                    'Điểm',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#dc2626"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#dc2626' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty message="Chưa có dữ liệu lịch sử cho đề thi này." />
          )}
        </div>
      </article>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <AttemptHistory
          history={history}
          loading={historyQuery.isLoading}
          currentAttemptId={currentAttemptId}
          page={page}
          onPageChange={setPage}
        />
        <ExamLeaderboard
          entries={leaderboardQuery.data?.entries ?? []}
          currentRank={leaderboardQuery.data?.currentUser?.rank}
          loading={leaderboardQuery.isLoading}
        />
      </div>
    </section>
  );
}

function AttemptHistory({
  history,
  loading,
  currentAttemptId,
  page,
  onPageChange,
}: {
  history?: ExamHistory;
  loading: boolean;
  currentAttemptId: string;
  page: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <article className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-neutral-100 p-6">
        <History className="h-5 w-5 text-primary-600" />
        <h2 className="font-bold text-neutral-900">Lịch sử làm bài</h2>
      </div>
      {loading ? (
        <div className="p-8"><ChartLoading /></div>
      ) : history?.data.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-6 py-3">Lần thi</th>
                  <th className="px-4 py-3">Ngày</th>
                  <th className="px-4 py-3">Kết quả</th>
                  <th className="px-6 py-3 text-right">Điểm</th>
                  <th className="px-6 py-3 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {history.data.map((attempt) => (
                  <tr
                    key={attempt.id}
                    className={
                      attempt.id === currentAttemptId ? 'bg-primary-50/70' : ''
                    }
                  >
                    <td className="px-6 py-4 font-semibold">
                      #{attempt.attemptNumber}
                      {attempt.id === currentAttemptId && (
                        <span className="ml-2 text-xs text-primary-700">
                          Đang xem
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-neutral-500">
                      {new Date(attempt.result.completedAt).toLocaleDateString(
                        'vi-VN',
                      )}
                    </td>
                    <td className="px-4 py-4 text-neutral-500">
                      {attempt.result.correctCount} đúng ·{' '}
                      {attempt.result.wrongCount} sai
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-primary-700">
                      {attempt.result.percentScore.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 text-right">
                      {attempt.id === currentAttemptId ? (
                        <span className="text-xs font-semibold text-neutral-400">
                          Hiện tại
                        </span>
                      ) : (
                        <Link
                          to={`/results/${attempt.id}`}
                          className="text-xs font-semibold text-primary-700 hover:underline"
                        >
                          Xem kết quả
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {history.meta.totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 border-t border-neutral-100 p-4">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                Trước
              </button>
              <span className="px-2 text-xs font-semibold text-neutral-500">
                {page}/{history.meta.totalPages}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page >= history.meta.totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Sau
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="p-8">
          <ChartEmpty message="Chưa có lượt thi nào." />
        </div>
      )}
    </article>
  );
}

function ExamLeaderboard({
  entries,
  currentRank,
  loading,
}: {
  entries: LeaderboardEntry[];
  currentRank?: number;
  loading: boolean;
}) {
  return (
    <article className="card p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h2 className="font-bold text-neutral-900">Bảng xếp hạng</h2>
        </div>
        {currentRank && (
          <span className="badge badge-primary">Hạng #{currentRank}</span>
        )}
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Xếp hạng theo điểm cao nhất của mỗi học viên
      </p>
      <div className="mt-5 space-y-2">
        {loading ? (
          <ChartLoading />
        ) : entries.length ? (
          entries.slice(0, 10).map((entry) => (
            <div
              key={entry.userId}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 ${
                entry.isCurrentUser
                  ? 'bg-primary-50 ring-1 ring-primary-100'
                  : 'bg-neutral-50'
              }`}
            >
              <span className="flex w-7 justify-center">
                {entry.rank <= 3 ? (
                  <Medal
                    className={`h-5 w-5 ${
                      entry.rank === 1
                        ? 'text-amber-500'
                        : 'text-neutral-400'
                    }`}
                  />
                ) : (
                  <span className="text-sm font-bold text-neutral-400">
                    {entry.rank}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {entry.displayName}
                {entry.isCurrentUser ? ' (Bạn)' : ''}
              </span>
              <strong className="text-sm text-primary-700">
                {entry.percentScore.toFixed(1)}%
              </strong>
            </div>
          ))
        ) : (
          <ChartEmpty message="Chưa có dữ liệu xếp hạng." />
        )}
      </div>
    </article>
  );
}

function ChartLoading() {
  return (
    <div className="flex h-full min-h-24 items-center justify-center gap-2 text-sm text-neutral-400">
      <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
      Đang tải dữ liệu...
    </div>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-24 items-center justify-center text-center text-sm text-neutral-400">
      {message}
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
