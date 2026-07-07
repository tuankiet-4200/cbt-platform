import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Eye,
  FilePlus2,
  GraduationCap,
  Loader2,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  listExams,
  previewExam,
  publishExam,
  type AdminExam,
  type ExamPreview,
} from '../api/exams.api';
import { ExamPreviewModal } from './ExamPreviewModal';

export default function AdminExamsPage() {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<ExamPreview | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const examsQuery = useQuery({
    queryKey: ['admin', 'exams'],
    queryFn: listExams,
  });

  const exams = examsQuery.data ?? [];
  const filteredExams = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return exams.filter((exam) => {
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'PUBLISHED' && exam.isPublished) ||
        (statusFilter === 'DRAFT' && !exam.isPublished);
      const matchesSearch = !normalizedSearch || exam.title.toLowerCase().includes(normalizedSearch);
      return matchesStatus && matchesSearch;
    });
  }, [exams, searchTerm, statusFilter]);

  const previewMutation = useMutation({
    mutationFn: previewExam,
    onSuccess: (result) => {
      setPreview(result);
      setActionError(null);
    },
    onError: (error) => setActionError(getErrorMessage(error) ?? 'Preview failed.'),
  });

  const publishMutation = useMutation({
    mutationFn: (exam: AdminExam) => publishExam(exam.id, !exam.isPublished),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
    },
    onError: (error) => setActionError(getErrorMessage(error) ?? 'Publish state update failed.'),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
            <GraduationCap className="h-4 w-4" />
            Exam Management
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">Quan ly de thi</h1>
          <p className="mt-1 text-sm text-neutral-500">Danh sach de da generate, preview va publish tu mot man hinh gon hon.</p>
        </div>
        <Link to="/admin/exams/create" className="btn btn-primary btn-md">
          <FilePlus2 className="h-4 w-4" />
          Create exam
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Total exams" value={exams.length} />
        <Metric label="Published" value={exams.filter((exam) => exam.isPublished).length} />
        <Metric label="Draft" value={exams.filter((exam) => !exam.isPublished).length} />
        <Metric label="Generated" value={exams.filter((exam) => exam.generatedAt).length} />
      </section>

      <section className="card overflow-hidden">
        {actionError && (
          <div className="border-b border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {actionError}
          </div>
        )}
        <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              className="input pl-9"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search exam"
            />
          </label>
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-neutral-200 bg-white p-1">
            {(['ALL', 'PUBLISHED', 'DRAFT'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'h-9 rounded-md px-3 text-sm font-semibold transition',
                  statusFilter === status ? 'bg-primary-600 text-white' : 'text-neutral-600 hover:bg-neutral-100',
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <Th>Exam</Th>
                <Th>Access</Th>
                <Th>Status</Th>
                <Th>Structure</Th>
                <Th>Generated</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {filteredExams.map((exam) => (
                <tr key={exam.id} className="hover:bg-neutral-50">
                  <td className="min-w-72 px-4 py-4">
                    <p className="font-semibold text-neutral-900">{exam.title}</p>
                    <p className="mt-1 text-sm text-neutral-500">{exam.durationMins} phut · {exam.totalPoints} points</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="badge badge-neutral">{exam.accessType}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={cn('badge', exam.isPublished ? 'badge-success' : 'badge-warning')}>
                      {exam.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="min-w-64 px-4 py-4">
                    <div className="grid grid-cols-3 gap-2">
                      <MetricMini label="M" value={exam.counts.mathQuestions} />
                      <MetricMini label="R" value={exam.counts.readingQuestions} />
                      <MetricMini label="S" value={exam.counts.scienceQuestions} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-neutral-500">
                    {formatDateTime(exam.generatedAt)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => previewMutation.mutate(exam.id)}
                        disabled={previewMutation.isPending}
                      >
                        {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                        Preview
                      </button>
                      <button
                        type="button"
                        className={cn('btn btn-sm', exam.isPublished ? 'btn-secondary' : 'btn-primary')}
                        onClick={() => publishMutation.mutate(exam)}
                        disabled={publishMutation.isPending}
                      >
                        {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        {exam.isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!examsQuery.isLoading && filteredExams.length === 0 && (
          <p className="p-8 text-center text-sm text-neutral-500">Khong co exam phu hop.</p>
        )}
        {examsQuery.isLoading && (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Dang tai exams...
          </div>
        )}
      </section>

      {preview && <ExamPreviewModal preview={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-neutral-900">{value}</p>
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
      <p className="text-[0.68rem] font-semibold uppercase text-neutral-500">{label}</p>
      <p className="mt-1 font-bold text-neutral-900">{value}</p>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={cn('px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500', align === 'right' ? 'text-right' : 'text-left')}>
      {children}
    </th>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return null;
}
