import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileText, Loader2, Search, XCircle } from 'lucide-react';
import {
  createContributionFileUrl,
  listContributions,
  updateContributionStatus,
  type ContributionStatus,
  type ContributionSubmission,
} from '../api/contributions.api';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS: Array<{ value: '' | ContributionStatus; label: string }> = [
  { value: '', label: 'All status' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'REVIEWING', label: 'Reviewing' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function AdminContributionsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'' | ContributionStatus>('');
  const [selected, setSelected] = useState<ContributionSubmission | null>(null);
  const [adminNote, setAdminNote] = useState('');

  const contributionsQuery = useQuery({
    queryKey: ['admin', 'contributions', status],
    queryFn: () => listContributions({ page: 1, limit: 50, status }),
  });

  const fileUrlQuery = useQuery({
    queryKey: ['admin', 'contributions', selected?.id, 'file-url'],
    queryFn: () => createContributionFileUrl(selected?.id ?? ''),
    enabled: Boolean(selected),
  });

  const updateMutation = useMutation({
    mutationFn: (nextStatus: Exclude<ContributionStatus, 'PENDING'>) =>
      updateContributionStatus(selected?.id ?? '', { status: nextStatus, adminNote }),
    onSuccess: (submission) => {
      setSelected(submission);
      queryClient.invalidateQueries({ queryKey: ['admin', 'contributions'] });
    },
  });

  const signedUrl = useMemo(() => {
    const payload = fileUrlQuery.data;
    if (!payload) return '';
    if (typeof payload === 'string') return payload;
    if (hasSignedUrl(payload)) return payload.signedUrl;
    return payload.url;
  }, [fileUrlQuery.data]);

  const submissions = contributionsQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
            <FileText className="h-4 w-4" />
            Contribution Review
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">Duyệt đóng góp</h1>
          <p className="mt-1 text-sm text-neutral-500">Xử lý PDF/DOCX cộng đồng gửi lên và ghi chú kết quả review.</p>
        </div>
        <select className="input w-56" value={status} onChange={(event) => setStatus(event.target.value as '' | ContributionStatus)}>
          {STATUS_OPTIONS.map((item) => (
            <option key={item.value || 'all'} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </header>

      <section className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <div className="card overflow-hidden">
          <div className="border-b border-neutral-200 p-4">
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Search className="h-4 w-4" />
              {contributionsQuery.isFetching ? 'Đang tải...' : `${submissions.length} submissions`}
            </div>
          </div>
          <div className="max-h-[42rem] overflow-y-auto">
            {submissions.map((submission) => (
              <button
                key={submission.id}
                className={cn(
                  'block w-full border-b border-neutral-100 p-4 text-left transition hover:bg-neutral-50',
                  selected?.id === submission.id && 'bg-primary-50',
                )}
                onClick={() => {
                  setSelected(submission);
                  setAdminNote(submission.adminNote ?? '');
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-neutral-900">{submission.title}</p>
                    <p className="mt-1 text-xs text-neutral-500">{submission.submitter.displayName}</p>
                  </div>
                  <span className={cn('badge', contributionBadgeClass(submission.status))}>{submission.status}</span>
                </div>
                {submission.description && <p className="mt-2 line-clamp-2 text-sm text-neutral-500">{submission.description}</p>}
              </button>
            ))}
            {!contributionsQuery.isLoading && submissions.length === 0 && (
              <div className="p-8 text-center text-sm text-neutral-500">Chưa có submission phù hợp.</div>
            )}
          </div>
        </div>

        <div className="card min-h-[34rem] p-5">
          {selected ? (
            <div className="grid h-full gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="min-h-[32rem] overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                {fileUrlQuery.isLoading && (
                  <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang tạo signed URL...
                  </div>
                )}
                {!fileUrlQuery.isLoading && signedUrl && selected.fileType === 'PDF' && (
                  <iframe src={signedUrl} title={selected.title} className="h-[34rem] w-full bg-white" />
                )}
                {!fileUrlQuery.isLoading && signedUrl && selected.fileType !== 'PDF' && (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                    <FileText className="h-10 w-10 text-primary-600" />
                    <a className="btn btn-primary btn-md" href={signedUrl} target="_blank" rel="noreferrer">
                      Mở file DOCX
                    </a>
                  </div>
                )}
              </div>

              <aside className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Submission</p>
                  <h2 className="mt-2 text-lg font-bold text-neutral-900">{selected.title}</h2>
                  <p className="mt-1 text-sm text-neutral-500">{selected.submitter.email}</p>
                </div>
                <label className="block">
                  <span className="label">Admin note</span>
                  <textarea
                    className="input min-h-32 resize-y"
                    value={adminNote}
                    onChange={(event) => setAdminNote(event.target.value)}
                  />
                </label>
                <div className="grid gap-2">
                  <button
                    className="btn btn-secondary btn-md"
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate('REVIEWING')}
                  >
                    <FileText className="h-4 w-4" />
                    Set reviewing
                  </button>
                  <button
                    className="btn btn-primary btn-md"
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate('APPROVED')}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    className="btn btn-danger btn-md"
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate('REJECTED')}
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </aside>
            </div>
          ) : (
            <div className="flex min-h-[30rem] items-center justify-center text-sm text-neutral-500">
              Chọn một submission để review.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function contributionBadgeClass(status: ContributionStatus) {
  if (status === 'APPROVED') return 'badge-success';
  if (status === 'REVIEWING') return 'badge-warning';
  if (status === 'REJECTED') return 'badge-danger';
  return 'badge-neutral';
}

function hasSignedUrl(payload: object): payload is { signedUrl: string } {
  return 'signedUrl' in payload;
}
