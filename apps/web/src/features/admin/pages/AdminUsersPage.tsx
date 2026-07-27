import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { SelectField } from '@/components/ui/SelectField';
import { useAuthStore } from '@/features/auth/store/auth.store';
import {
  listUsers,
  updateUserRole,
  updateUserStatus,
  type ManagedUser,
  type UserRole,
} from '../api/users.api';

export default function AdminUsersPage() {
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', page, search, role, status],
    queryFn: () =>
      listUsers({
        page,
        search: search || undefined,
        role: (role || undefined) as UserRole | undefined,
        isActive:
          status === 'ACTIVE'
            ? true
            : status === 'INACTIVE'
              ? false
              : undefined,
      }),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  const statusMutation = useMutation({
    mutationFn: ({
      id,
      isActive,
    }: {
      id: string;
      isActive: boolean;
    }) => updateUserStatus(id, isActive),
    onSuccess: async () => {
      setActionError(null);
      await refresh();
    },
    onError: (error) =>
      setActionError(getApiErrorMessage(error, 'Không thể cập nhật trạng thái.')),
  });
  const roleMutation = useMutation({
    mutationFn: ({ id, nextRole }: { id: string; nextRole: UserRole }) =>
      updateUserRole(id, nextRole),
    onSuccess: async () => {
      setActionError(null);
      await refresh();
    },
    onError: (error) =>
      setActionError(getApiErrorMessage(error, 'Không thể cập nhật vai trò.')),
  });

  const data = usersQuery.data;
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary-700">Quản trị hệ thống</p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">
          Quản lý người dùng
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Tìm kiếm tài khoản, quản lý quyền truy cập và vai trò hệ thống.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric
          icon={Users}
          label="Kết quả tìm thấy"
          value={data?.meta.total ?? 0}
          tone="text-blue-700 bg-blue-50"
        />
        <Metric
          icon={UserCheck}
          label="Tài khoản hoạt động"
          value={data?.summary.active ?? 0}
          tone="text-success-700 bg-success-50"
        />
        <Metric
          icon={ShieldCheck}
          label="Quản trị viên"
          value={data?.summary.admins ?? 0}
          tone="text-primary-700 bg-primary-50"
        />
      </section>

      <section className="card p-5">
        <form
          onSubmit={submitSearch}
          className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem_auto]"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="input pl-9"
              placeholder="Tìm theo tên hoặc email"
            />
          </div>
          <SelectField
            value={role}
            onChange={(value) => {
              setRole(value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'Tất cả vai trò' },
              { value: 'USER', label: 'Học viên' },
              { value: 'ADMIN', label: 'Quản trị viên' },
            ]}
          />
          <SelectField
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'ACTIVE', label: 'Đang hoạt động' },
              { value: 'INACTIVE', label: 'Đã khóa' },
            ]}
          />
          <button type="submit" className="btn btn-primary">
            <Search className="h-4 w-4" />
            Tìm kiếm
          </button>
        </form>
        {actionError && (
          <p className="mt-4 rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {actionError}
          </p>
        )}
      </section>

      <section className="card overflow-hidden">
        {usersQuery.isLoading ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-neutral-500">
            <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
            Đang tải danh sách người dùng...
          </div>
        ) : usersQuery.isError ? (
          <div className="p-8 text-center text-sm text-danger-700">
            {getApiErrorMessage(
              usersQuery.error,
              'Không thể tải danh sách người dùng.',
            )}
          </div>
        ) : data?.data.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-6 py-4">Người dùng</th>
                    <th className="px-4 py-4">Hoạt động</th>
                    <th className="px-4 py-4">Ngày tham gia</th>
                    <th className="px-4 py-4">Vai trò</th>
                    <th className="px-6 py-4 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {data.data.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      isSelf={user.id === currentUser?.id}
                      busy={statusMutation.isPending || roleMutation.isPending}
                      onRole={(nextRole) =>
                        roleMutation.mutate({ id: user.id, nextRole })
                      }
                      onStatus={(isActive) =>
                        statusMutation.mutate({ id: user.id, isActive })
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-neutral-100 px-6 py-4">
              <span className="text-xs text-neutral-500">
                Trang {data.meta.page}/{Math.max(1, data.meta.totalPages)} ·{' '}
                {data.meta.total} tài khoản
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Trang trước"
                  title="Trang trước"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-600 shadow-sm transition-colors hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-300 disabled:shadow-none"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Trang sau"
                  title="Trang sau"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-600 shadow-sm transition-colors hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-300 disabled:shadow-none"
                  disabled={page >= data.meta.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center text-center">
            <Users className="h-9 w-9 text-neutral-300" />
            <p className="mt-3 font-semibold text-neutral-700">
              Không tìm thấy người dùng
            </p>
            <p className="mt-1 text-sm text-neutral-400">
              Hãy thử thay đổi từ khóa hoặc bộ lọc.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function UserRow({
  user,
  isSelf,
  busy,
  onRole,
  onStatus,
}: {
  user: ManagedUser;
  isSelf: boolean;
  busy: boolean;
  onRole: (role: UserRole) => void;
  onStatus: (isActive: boolean) => void;
}) {
  return (
    <tr className={!user.isActive ? 'bg-neutral-50/70' : ''}>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 font-bold text-primary-700">
            {user.displayName[0]?.toUpperCase() ?? 'U'}
          </span>
          <div>
            <div className="font-semibold text-neutral-900">
              {user.displayName}
              {isSelf && (
                <span className="ml-2 text-xs font-medium text-primary-600">
                  Bạn
                </span>
              )}
            </div>
            <div className="text-xs text-neutral-500">{user.email}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-xs text-neutral-500">
        <div>{user._count.examAttempts} lượt thi</div>
        <div className="mt-1">
          {user._count.examAccesses} đề · {user._count.contributions} đóng góp
        </div>
      </td>
      <td className="px-4 py-4 text-neutral-500">
        {new Date(user.createdAt).toLocaleDateString('vi-VN')}
      </td>
      <td className="px-4 py-4">
        <SelectField
          value={user.role}
          disabled={busy || isSelf}
          onChange={(value) => onRole(value as UserRole)}
          options={[
            { value: 'USER', label: 'Học viên' },
            { value: 'ADMIN', label: 'Quản trị viên' },
          ]}
          className="w-40"
        />
      </td>
      <td className="px-6 py-4 text-right">
        <button
          type="button"
          disabled={busy || isSelf}
          onClick={() => onStatus(!user.isActive)}
          className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            user.isActive
              ? 'bg-danger-50 text-danger-700 hover:bg-danger-100'
              : 'bg-success-50 text-success-700 hover:bg-success-100'
          }`}
        >
          {user.isActive ? (
            <><Ban className="h-4 w-4" /> Khóa</>
          ) : (
            <><CheckCircle2 className="h-4 w-4" /> Mở khóa</>
          )}
        </button>
      </td>
    </tr>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <article className="card flex items-center gap-4 p-5">
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {label}
        </p>
        <strong className="mt-1 block text-2xl text-neutral-900">{value}</strong>
      </div>
    </article>
  );
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (message) return message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
