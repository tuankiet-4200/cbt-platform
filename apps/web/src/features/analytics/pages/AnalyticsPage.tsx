import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Clock3,
  History,
  Loader2,
  Medal,
  Target,
  Trophy,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SelectField } from '@/components/ui/SelectField';
import { listAvailableExams } from '@/features/exams/api/exams.api';
import {
  getExamHistory,
  getLeaderboard,
  getTimeAnalysis,
  getWeaknesses,
} from '../api/analytics.api';

const SECTION_LABEL = {
  MATH: 'Toán học',
  READING: 'Đọc hiểu',
  SCIENCE: 'Khoa học',
};

export default function AnalyticsPage() {
  const [examId, setExamId] = useState('');
  const [page, setPage] = useState(1);
  const examsQuery = useQuery({
    queryKey: ['available-exams'],
    queryFn: listAvailableExams,
  });
  const weaknessesQuery = useQuery({
    queryKey: ['analytics', 'weaknesses'],
    queryFn: getWeaknesses,
  });
  const timeQuery = useQuery({
    queryKey: ['analytics', 'time'],
    queryFn: getTimeAnalysis,
  });
  const historyQuery = useQuery({
    queryKey: ['analytics', 'history', examId, page],
    queryFn: () => getExamHistory(examId, page),
    enabled: Boolean(examId),
  });
  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard', examId],
    queryFn: () => getLeaderboard(examId),
    enabled: Boolean(examId),
  });

  useEffect(() => {
    if (!examId && examsQuery.data?.[0]) setExamId(examsQuery.data[0].id);
  }, [examId, examsQuery.data]);

  const progressData = useMemo(
    () =>
      [...(historyQuery.data?.data ?? [])]
        .reverse()
        .map((attempt) => ({
          name: `Lần ${attempt.attemptNumber}`,
          score: Number(attempt.result.percentScore.toFixed(1)),
        })),
    [historyQuery.data],
  );

  const totalAttempts = historyQuery.data?.meta.total ?? 0;
  const latestScore = historyQuery.data?.data[0]?.result.percentScore;
  const averageTime = timeQuery.data?.averageTimeSecs ?? 0;

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-950 via-[#172554] to-primary-950 p-7 text-white shadow-xl md:p-9">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary-200">Hành trình luyện thi TSA</p>
            <h1 className="mt-2 text-3xl font-black">Phân tích năng lực cá nhân</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-300">
              Theo dõi tiến bộ, nhận diện chủ đề cần cải thiện và so sánh nhịp độ làm bài
              với thời gian chuẩn.
            </p>
          </div>
          <SelectField
            value={examId}
            onChange={(value) => {
              setExamId(value);
              setPage(1);
            }}
            options={(examsQuery.data ?? []).map((exam) => ({
              value: exam.id,
              label: exam.title,
            }))}
            placeholder={examsQuery.isLoading ? 'Đang tải đề thi...' : 'Chọn đề thi'}
            className="w-full lg:w-80"
            buttonClassName="border-white/20 bg-white/10 text-white hover:bg-white/15"
          />
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={History} label="Số lần hoàn thành" value={String(totalAttempts)} />
        <MetricCard
          icon={Target}
          label="Điểm lần gần nhất"
          value={latestScore === undefined ? '—' : `${latestScore.toFixed(1)}%`}
        />
        <MetricCard
          icon={Clock3}
          label="Thời gian / câu"
          value={averageTime ? `${averageTime.toFixed(1)} giây` : '—'}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <article className="card p-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary-600" />
            <h2 className="font-bold text-neutral-900">Tiến bộ qua các lần thi</h2>
          </div>
          <div className="mt-5 h-72">
            {historyQuery.isLoading ? (
              <LoadingState />
            ) : progressData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressData} margin={{ left: -20, right: 14 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Điểm']} />
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
              <EmptyState message="Hoàn thành đề thi để bắt đầu theo dõi tiến bộ." />
            )}
          </div>
        </article>

        <InsightCard
          title="Cần cải thiện"
          icon={ArrowDownRight}
          items={weaknessesQuery.data?.weaknesses ?? []}
          loading={weaknessesQuery.isLoading}
          tone="danger"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <InsightCard
          title="Điểm mạnh"
          icon={ArrowUpRight}
          items={weaknessesQuery.data?.strengths ?? []}
          loading={weaknessesQuery.isLoading}
          tone="success"
        />

        <article className="card p-6">
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-blue-600" />
            <h2 className="font-bold text-neutral-900">Nhịp độ theo phần thi</h2>
          </div>
          <div className="mt-5 h-64">
            {timeQuery.isLoading ? (
              <LoadingState />
            ) : timeQuery.data?.sections.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={timeQuery.data.sections.map((row) => ({
                    section: SECTION_LABEL[row.section],
                    actual: Number(row.averageTimeSecs.toFixed(1)),
                    expected: Number(row.expectedTimeSecs.toFixed(1)),
                  }))}
                  margin={{ left: -12, right: 12 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="section" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="s" />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)} giây`]} />
                  <Legend />
                  <Line name="Thực tế" dataKey="actual" stroke="#2563eb" strokeWidth={3} />
                  <Line name="Thời gian chuẩn" dataKey="expected" stroke="#9ca3af" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="Chưa có dữ liệu thời gian làm bài." />
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <HistoryTable
          loading={historyQuery.isLoading}
          history={historyQuery.data}
          page={page}
          onPageChange={setPage}
        />
        <LeaderboardCard
          loading={leaderboardQuery.isLoading}
          entries={leaderboardQuery.data?.entries ?? []}
          currentRank={leaderboardQuery.data?.currentUser?.rank}
        />
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: string;
}) {
  return (
    <article className="card flex items-center gap-4 p-5">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
        <strong className="mt-1 block text-2xl text-neutral-900">{value}</strong>
      </div>
    </article>
  );
}

function InsightCard({
  title,
  icon: Icon,
  items,
  loading,
  tone,
}: {
  title: string;
  icon: typeof ArrowDownRight;
  items: Array<{ tagId: string; tagName: string; accuracy: number; correct: number; total: number }>;
  loading: boolean;
  tone: 'danger' | 'success';
}) {
  const color = tone === 'danger' ? 'text-danger-600 bg-danger-50' : 'text-success-700 bg-success-50';
  return (
    <article className="card p-6">
      <div className="flex items-center gap-2">
        <span className={`rounded-lg p-2 ${color}`}><Icon className="h-4 w-4" /></span>
        <h2 className="font-bold text-neutral-900">{title}</h2>
      </div>
      <div className="mt-5 space-y-4">
        {loading ? (
          <LoadingState />
        ) : items.length ? (
          items.map((item) => (
            <div key={item.tagId}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate font-medium text-neutral-700">{item.tagName}</span>
                <span className="shrink-0 text-neutral-500">
                  {item.accuracy.toFixed(0)}% · {item.correct}/{item.total}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full rounded-full ${tone === 'danger' ? 'bg-danger-500' : 'bg-success-500'}`}
                  style={{ width: `${item.accuracy}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <EmptyState message="Chưa đủ dữ liệu để phân tích." />
        )}
      </div>
    </article>
  );
}

function HistoryTable({
  loading,
  history,
  page,
  onPageChange,
}: {
  loading: boolean;
  history?: Awaited<ReturnType<typeof getExamHistory>>;
  page: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <article className="card overflow-hidden">
      <div className="border-b border-neutral-100 p-6">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary-600" />
          <h2 className="font-bold text-neutral-900">Lịch sử làm bài</h2>
        </div>
      </div>
      {loading ? (
        <div className="p-8"><LoadingState /></div>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {history.data.map((attempt) => (
                  <tr key={attempt.id}>
                    <td className="px-6 py-4 font-semibold">#{attempt.attemptNumber}</td>
                    <td className="px-4 py-4 text-neutral-500">
                      {new Date(attempt.result.completedAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-4 text-neutral-500">
                      {attempt.result.correctCount} đúng · {attempt.result.wrongCount} sai
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-primary-700">
                      {attempt.result.percentScore.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {history.meta.totalPages > 1 && (
            <div className="flex justify-end gap-2 border-t border-neutral-100 p-4">
              <button className="btn btn-secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                Trước
              </button>
              <button className="btn btn-secondary" disabled={page >= history.meta.totalPages} onClick={() => onPageChange(page + 1)}>
                Sau
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="p-8"><EmptyState message="Bạn chưa hoàn thành đề thi này." /></div>
      )}
    </article>
  );
}

function LeaderboardCard({
  loading,
  entries,
  currentRank,
}: {
  loading: boolean;
  entries: Array<{
    rank: number;
    userId: string;
    displayName: string;
    percentScore: number;
    isCurrentUser: boolean;
  }>;
  currentRank?: number;
}) {
  return (
    <article className="card p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h2 className="font-bold text-neutral-900">Bảng xếp hạng</h2>
        </div>
        {currentRank && <span className="badge badge-primary">Hạng #{currentRank}</span>}
      </div>
      <div className="mt-5 space-y-2">
        {loading ? (
          <LoadingState />
        ) : entries.length ? (
          entries.slice(0, 10).map((entry) => (
            <div
              key={entry.userId}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 ${
                entry.isCurrentUser ? 'bg-primary-50 ring-1 ring-primary-100' : 'bg-neutral-50'
              }`}
            >
              <span className="flex w-7 justify-center">
                {entry.rank <= 3 ? (
                  <Medal className={`h-5 w-5 ${entry.rank === 1 ? 'text-amber-500' : 'text-neutral-400'}`} />
                ) : (
                  <span className="text-sm font-bold text-neutral-400">{entry.rank}</span>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {entry.displayName}{entry.isCurrentUser ? ' (Bạn)' : ''}
              </span>
              <strong className="text-sm text-primary-700">{entry.percentScore.toFixed(1)}%</strong>
            </div>
          ))
        ) : (
          <EmptyState message="Chưa có dữ liệu xếp hạng cho đề này." />
        )}
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full min-h-24 items-center justify-center gap-2 text-sm text-neutral-400">
      <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
      Đang tổng hợp dữ liệu...
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-24 flex-col items-center justify-center text-center text-sm text-neutral-400">
      <AlertCircle className="mb-2 h-6 w-6" />
      {message}
    </div>
  );
}
