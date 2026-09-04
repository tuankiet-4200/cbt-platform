import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  Check,
  Clipboard,
  KeyRound,
  Loader2,
  Plus,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SelectField } from '@/components/ui/SelectField';
import { listExams } from '../api/exams.api';
import {
  createAccessCode,
  deactivateAccessCode,
  listAccessCodes,
  type AccessCodeStatus,
  type AdminAccessCode,
} from '../api/accessCodes.api';

export default function AdminCodesPage() {
  const queryClient = useQueryClient();
  const [examId, setExamId] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const examsQuery = useQuery({
    queryKey: ['admin', 'exams'],
    queryFn: listExams,
  });

  const codesQuery = useQuery({
    queryKey: ['admin', 'access-codes'],
    queryFn: listAccessCodes,
  });

  const lockedPublishedExams = useMemo(
    () => (examsQuery.data ?? []).filter((exam) => exam.accessType === 'LOCKED' && exam.isPublished),
    [examsQuery.data],
  );

  useEffect(() => {
    if (!examId && lockedPublishedExams[0]) setExamId(lockedPublishedExams[0].id);
  }, [examId, lockedPublishedExams]);

  const codes = codesQuery.data ?? [];
  const metrics = {
    total: codes.length,
    active: codes.filter((code) => resolveStatus(code) === 'ACTIVE').length,
    exhausted: codes.filter((code) => resolveStatus(code) === 'EXHAUSTED').length,
    inactive: codes.filter((code) => resolveStatus(code) === 'INACTIVE').length,
  };

  const createMutation = useMutation({
    mutationFn: () => createAccessCode({
      examId,
      maxUses: maxUses ? Number(maxUses) : undefined,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    }),
    onSuccess: (code) => {
      setActionError(null);
      setMaxUses('');
      setExpiresAt('');
      setCopiedCode(code.code);
      queryClient.invalidateQueries({ queryKey: ['admin', 'access-codes'] });
    },
    onError: (error) => setActionError(getErrorMessage(error) ?? 'Khong tao duoc ma truy cap.'),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateAccessCode,
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'access-codes'] });
    },
    onError: (error) => setActionError(getErrorMessage(error) ?? 'Khong vo hieu hoa duoc ma truy cap.'),
  });

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
            <Shield className="h-4 w-4" />
            Access Code Management
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">Quản lý mã truy cập</h1>
          <p className="mt-1 text-sm text-neutral-500">Tạo mã mở khóa cho các đề LOCKED đã publish và theo dõi quota sử dụng.</p>
        </div>
      </header>

      {actionError && (
        <div className="rounded-lg border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">{actionError}</div>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Total codes" value={metrics.total} />
        <Metric label="Active" value={metrics.active} />
        <Metric label="Exhausted" value={metrics.exhausted} />
        <Metric label="Inactive" value={metrics.inactive} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <aside className="card p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
            <KeyRound className="h-4 w-4" />
            Create access code
          </div>

          <label className="mt-4 block">
            <span className="label">Locked published exam</span>
            <SelectField
              value={examId}
              options={lockedPublishedExams.map((exam) => ({
                value: exam.id,
                label: exam.title,
                description: `${exam.durationMins} min · ${exam.counts.mathQuestions + exam.counts.readingQuestions + exam.counts.scienceQuestions} questions`,
              }))}
              placeholder={examsQuery.isLoading ? 'Loading exams...' : 'No eligible exam'}
              disabled={lockedPublishedExams.length === 0 || examsQuery.isLoading}
              onChange={setExamId}
            />
          </label>

          <label className="mt-4 block">
            <span className="label">Max uses</span>
            <input
              className="input"
              type="number"
              min={1}
              value={maxUses}
              onChange={(event) => setMaxUses(event.target.value)}
              placeholder="Unlimited"
            />
          </label>

          <label className="mt-4 block">
            <span className="label">Expires at</span>
            <input
              className="input"
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </label>

          <button
            className="btn btn-primary btn-md mt-5 w-full"
            type="button"
            disabled={!examId || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Generate code
          </button>

          {lockedPublishedExams.length === 0 && !examsQuery.isLoading && (
            <p className="mt-4 rounded-lg bg-warning-50 p-3 text-sm text-warning-700">
              Chưa có đề LOCKED đã publish. Hãy publish đề locked trước khi tạo mã.
            </p>
          )}
        </aside>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 p-5">
            <h2 className="font-semibold text-neutral-900">Access codes</h2>
            {codesQuery.isFetching && <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />}
          </div>

          <div>
            <table className="w-full table-fixed divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <Th className="w-[18%]">Mã</Th>
                  <Th className="w-[28%]">Đề thi</Th>
                  <Th className="w-[12%]">Sử dụng</Th>
                  <Th className="w-[20%]">Hiệu lực</Th>
                  <Th className="w-[22%]" align="right">Thao tác</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {codes.map((code) => (
                  <tr key={code.id} className="hover:bg-neutral-50">
                    <td className="whitespace-nowrap px-3 py-4">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate rounded-md bg-neutral-100 px-2 py-1 font-mono text-xs font-bold tracking-wide text-neutral-900" title={code.code}>{code.code}</span>
                        {copiedCode === code.code && <Check className="h-4 w-4 text-success-600" />}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <p className="truncate font-semibold text-neutral-900" title={code.exam.title}>{code.exam.title}</p>
                      <p className="mt-1 truncate text-xs text-neutral-500">{code.exam.durationMins} phút · {code.exam.isPublished ? 'Đã phát hành' : 'Bản nháp'}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-neutral-600">
                      {code.usedCount} / {code.maxUses ?? '∞'}
                    </td>
                    <td className="px-3 py-4">
                      <span className={cn('badge', statusBadgeClass(resolveStatus(code)))}>{resolveStatus(code)}</span>
                      <p className="mt-1 truncate text-xs text-neutral-500" title={formatDateTime(code.expiresAt)}>{formatDateTime(code.expiresAt)}</p>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex justify-end gap-1.5">
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => copyCode(code.code)}>
                          <Clipboard className="h-4 w-4" />
                          Copy
                        </button>
                        <button
                          className="btn btn-secondary btn-sm px-2"
                          type="button"
                          disabled={!code.isActive || deactivateMutation.isPending}
                          onClick={() => deactivateMutation.mutate(code.id)}
                          title="Vô hiệu hóa mã"
                          aria-label="Vô hiệu hóa mã"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!codesQuery.isLoading && codes.length === 0 && (
            <p className="p-8 text-center text-sm text-neutral-500">Chưa có mã truy cập nào.</p>
          )}
          {codesQuery.isLoading && (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải mã truy cập...
            </div>
          )}
        </section>
      </section>
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

function Th({ children, align = 'left', className }: { children: React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  return (
    <th className={cn('px-3 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500', align === 'right' ? 'text-right' : 'text-left', className)}>
      {children}
    </th>
  );
}

function resolveStatus(code: AdminAccessCode): AccessCodeStatus {
  if (code.status) return code.status;
  if (!code.isActive) return 'INACTIVE';
  if (code.expiresAt && new Date(code.expiresAt) <= new Date()) return 'EXPIRED';
  if (code.maxUses !== null && code.maxUses !== undefined && code.usedCount >= code.maxUses) return 'EXHAUSTED';
  return 'ACTIVE';
}

function statusBadgeClass(status: AccessCodeStatus) {
  if (status === 'ACTIVE') return 'badge-success';
  if (status === 'EXHAUSTED') return 'badge-warning';
  if (status === 'EXPIRED') return 'badge-danger';
  return 'badge-neutral';
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return null;
}
