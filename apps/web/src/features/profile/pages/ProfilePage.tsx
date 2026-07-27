import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  BookOpen,
  CheckCircle2,
  FileUp,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLogoutMutation } from '@/features/auth/api/useAuth';
import { useAuthStore } from '@/features/auth/store/auth.store';
import {
  changeMyPassword,
  getMyProfile,
  updateMyProfile,
} from '../api/profile.api';

export default function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const updateAuthUser = useAuthStore((state) => state.updateUser);
  const logoutMutation = useLogoutMutation();
  const [displayName, setDisplayName] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: getMyProfile,
  });
  useEffect(() => {
    if (profileQuery.data) setDisplayName(profileQuery.data.displayName);
  }, [profileQuery.data]);

  const profileMutation = useMutation({
    mutationFn: () => updateMyProfile(displayName.trim()),
    onSuccess: async (user) => {
      updateAuthUser(user);
      setProfileMessage('Đã cập nhật tên hiển thị.');
      await queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
    onError: (error) =>
      setProfileMessage(
        getApiErrorMessage(error, 'Không thể cập nhật thông tin tài khoản.'),
      ),
  });
  const passwordMutation = useMutation({
    mutationFn: () =>
      changeMyPassword({
        currentPassword,
        newPassword,
      }),
    onSuccess: async () => {
      setPasswordError(null);
      await logoutMutation.mutateAsync();
      navigate('/login', { replace: true });
    },
    onError: (error) =>
      setPasswordError(
        getApiErrorMessage(error, 'Không thể thay đổi mật khẩu.'),
      ),
  });

  if (profileQuery.isLoading) {
    return (
      <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-neutral-500">
        <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
        Đang tải tài khoản...
      </div>
    );
  }
  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className="card p-8 text-center text-danger-700">
        {getApiErrorMessage(
          profileQuery.error,
          'Không thể tải thông tin tài khoản.',
        )}
      </div>
    );
  }

  const profile = profileQuery.data;
  const submitProfile = (event: FormEvent) => {
    event.preventDefault();
    setProfileMessage(null);
    if (displayName.trim().length < 2) {
      setProfileMessage('Tên hiển thị phải có ít nhất 2 ký tự.');
      return;
    }
    profileMutation.mutate();
  };
  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Xác nhận mật khẩu mới không khớp.');
      return;
    }
    passwordMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-950 via-[#172554] to-primary-950 p-7 text-white shadow-xl md:p-9">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="relative flex items-center gap-5">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-white/10 text-3xl font-black ring-1 ring-white/15">
            {profile.displayName[0]?.toUpperCase() ?? 'U'}
          </span>
          <div>
            <p className="text-sm font-semibold text-primary-200">
              Tài khoản cá nhân
            </p>
            <h1 className="mt-1 text-3xl font-black">{profile.displayName}</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-neutral-300">
              <Mail className="h-4 w-4" />
              {profile.email}
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric
          icon={BookOpen}
          label="Lượt thi"
          value={profile._count.examAttempts}
        />
        <Metric
          icon={ShieldCheck}
          label="Đề đã mở"
          value={profile._count.examAccesses}
        />
        <Metric
          icon={FileUp}
          label="Đóng góp"
          value={profile._count.contributions}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={submitProfile} className="card p-6">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-primary-50 p-2.5 text-primary-700">
              <User className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold text-neutral-900">Thông tin cá nhân</h2>
              <p className="text-sm text-neutral-500">
                Cập nhật tên hiển thị trên hệ thống.
              </p>
            </div>
          </div>
          <label className="mt-6 block">
            <span className="text-sm font-semibold text-neutral-700">
              Tên hiển thị
            </span>
            <input
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setProfileMessage(null);
              }}
              maxLength={120}
              className="input mt-2"
            />
          </label>
          <label className="mt-4 block">
            <span className="text-sm font-semibold text-neutral-700">Email</span>
            <input
              value={profile.email}
              disabled
              className="input mt-2 bg-neutral-50 text-neutral-500"
            />
            <span className="mt-1 block text-xs text-neutral-400">
              Email đăng nhập hiện không thể thay đổi.
            </span>
          </label>
          <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
            <CheckCircle2 className="h-4 w-4 text-success-600" />
            Trạng thái: {profile.isActive ? 'Đang hoạt động' : 'Đã khóa'} ·{' '}
            {profile.role === 'ADMIN' ? 'Quản trị viên' : 'Học viên'}
          </div>
          {profileMessage && (
            <p className="mt-4 rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              {profileMessage}
            </p>
          )}
          <button
            type="submit"
            disabled={
              profileMutation.isPending ||
              displayName.trim() === profile.displayName
            }
            className="btn btn-primary mt-6"
          >
            {profileMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Lưu thay đổi
          </button>
        </form>

        <form onSubmit={submitPassword} className="card p-6">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-amber-50 p-2.5 text-amber-700">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold text-neutral-900">Đổi mật khẩu</h2>
              <p className="text-sm text-neutral-500">
                Bạn sẽ cần đăng nhập lại sau khi đổi mật khẩu.
              </p>
            </div>
          </div>
          <PasswordField
            label="Mật khẩu hiện tại"
            value={currentPassword}
            onChange={setCurrentPassword}
          />
          <PasswordField
            label="Mật khẩu mới"
            value={newPassword}
            onChange={setNewPassword}
          />
          <PasswordField
            label="Xác nhận mật khẩu mới"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />
          {passwordError && (
            <p className="mt-4 rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {passwordError}
            </p>
          )}
          <button
            type="submit"
            disabled={
              passwordMutation.isPending ||
              logoutMutation.isPending ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
            className="btn btn-secondary mt-6"
          >
            {(passwordMutation.isPending || logoutMutation.isPending) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Đổi mật khẩu
          </button>
        </form>
      </section>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-5 block">
      <span className="text-sm font-semibold text-neutral-700">{label}</span>
      <div className="relative mt-2">
        <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={
            label === 'Mật khẩu hiện tại' ? 'current-password' : 'new-password'
          }
          maxLength={128}
          className="input pl-9"
        />
      </div>
    </label>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number;
}) {
  return (
    <article className="card flex items-center gap-4 p-5">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
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
