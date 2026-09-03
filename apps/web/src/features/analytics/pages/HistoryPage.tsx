import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Eye, History, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAttemptHistory } from '../api/analytics.api';

const SECTION_LABELS = {
  MATH: 'Toán học',
  READING: 'Đọc hiểu',
  SCIENCE: 'Khoa học',
} as const;

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const historyQuery = useQuery({
    queryKey: ['attempt-history', page],
    queryFn: () => getAttemptHistory(page),
    placeholderData: (previous) => previous,
  });

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-sm font-semibold text-primary-700">
          <History className="h-4 w-4" />
          Hoạt động học tập
        </div>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">Lịch sử làm bài</h1>
        <p className="mt-1 text-sm text-neutral-500">Xem điểm và mở lại chi tiết các lượt thi đã hoàn thành.</p>
      </header>

      {historyQuery.isLoading ? (
        <div className="card flex min-h-64 items-center justify-center gap-2 text-neutral-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Đang tải lịch sử...
        </div>
      ) : historyQuery.isError || !historyQuery.data ? (
        <div className="card p-8 text-center text-danger-700">Không thể tải lịch sử làm bài.</div>
      ) : historyQuery.data.data.length === 0 ? (
        <div className="card p-10 text-center">
          <History className="mx-auto h-10 w-10 text-neutral-300" />
          <p className="mt-3 text-sm text-neutral-500">Bạn chưa hoàn thành lượt thi nào.</p>
          <Link to="/exams" className="btn btn-primary mt-5">Xem đề thi</Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {historyQuery.data.data.map((attempt) => (
              <article key={attempt.id} className="card p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate font-bold text-neutral-900">{attempt.exam.title}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(attempt.completedAt ?? attempt.result.completedAt)}</span>
                      {attempt.selectedSections.map((section) => (
                        <span key={section} className="badge badge-neutral">{SECTION_LABELS[section]}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-black text-primary-700">{attempt.result.percentScore.toFixed(1)}%</p>
                      <p className="text-xs text-neutral-500">{attempt.result.totalScore}/{attempt.result.maxScore} điểm</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-success-700"><CheckCircle2 className="h-4 w-4" />{attempt.result.correctCount} đúng</span>
                    <Link to={`/results/${attempt.id}`} className="btn btn-secondary btn-sm">Kết quả</Link>
                    <Link to={`/results/${attempt.id}/review`} className="btn btn-primary btn-sm"><Eye className="h-4 w-4" />Xem lại</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {historyQuery.data.meta.totalPages > 1 && (
            <nav className="card flex items-center justify-between p-4">
              <button className="btn btn-secondary btn-sm" disabled={page === 1 || historyQuery.isFetching} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" />Trang trước</button>
              <span className="text-sm font-semibold text-neutral-600">{page} / {historyQuery.data.meta.totalPages}</span>
              <button className="btn btn-secondary btn-sm" disabled={page >= historyQuery.data.meta.totalPages || historyQuery.isFetching} onClick={() => setPage((value) => value + 1)}>Trang sau<ChevronRight className="h-4 w-4" /></button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
