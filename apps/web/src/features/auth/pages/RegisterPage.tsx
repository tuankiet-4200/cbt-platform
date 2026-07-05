import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, Lock, Mail, Phone, User } from 'lucide-react';
import { useRegisterMutation } from '../api/useAuth';

const schema = z
  .object({
    displayName: z.string().min(2, 'Vui lòng nhập họ tên').max(120),
    email: z.string().email('Email không hợp lệ'),
    phone: z.string().max(32).optional(),
    password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại không khớp',
  });

type RegisterForm = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const registerMutation = useRegisterMutation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async ({ confirmPassword: _confirmPassword, ...values }: RegisterForm) => {
    setSubmitError(null);
    try {
      await registerMutation.mutateAsync(values);
      navigate('/exams', { replace: true });
    } catch {
      setSubmitError('Không thể đăng ký tài khoản. Email có thể đã được sử dụng.');
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-5 text-center">
        <h1 className="text-3xl font-semibold text-neutral-900">Đăng ký tài khoản</h1>
        <p className="text-sm text-neutral-700">
          Bạn đã có tài khoản?{' '}
          <Link className="font-medium text-[#d8172a] hover:text-[#b91222]" to="/login">
            Đăng nhập ngay
          </Link>
        </p>
      </div>

      <div className="space-y-4 pt-4">
        <AuthField error={errors.displayName?.message} icon={<User className="h-4 w-4 text-neutral-500" />} label="Họ tên" required>
          <input className="auth-input" autoComplete="name" placeholder="Điền đầy đủ theo họ tên trên CMND/CCCD" {...register('displayName')} />
        </AuthField>

        <AuthField error={errors.email?.message} icon={<Mail className="h-4 w-4 text-neutral-500" />} label="Email" required>
          <input className="auth-input" type="email" autoComplete="email" placeholder="Điền chính xác email để nhận thông tin" {...register('email')} />
        </AuthField>

        <AuthField error={errors.phone?.message} icon={<Phone className="h-4 w-4 text-neutral-500" />} label="Số điện thoại">
          <input className="auth-input" type="tel" autoComplete="tel" placeholder="Số điện thoại liên hệ" {...register('phone')} />
        </AuthField>

        <AuthField
          error={errors.password?.message}
          icon={<Lock className="h-4 w-4 text-neutral-500" />}
          label="Mật khẩu"
          required
          trailing={
            <PasswordToggle
              shown={showPassword}
              onClick={() => setShowPassword((value) => !value)}
            />
          }
        >
          <input className="auth-input" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Nhập mật khẩu" {...register('password')} />
        </AuthField>

        <AuthField
          error={errors.confirmPassword?.message}
          icon={<Lock className="h-4 w-4 text-neutral-500" />}
          label="Nhập lại mật khẩu"
          required
          trailing={
            <PasswordToggle
              shown={showConfirmPassword}
              onClick={() => setShowConfirmPassword((value) => !value)}
            />
          }
        >
          <input className="auth-input" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Xác nhận lại mật khẩu" {...register('confirmPassword')} />
        </AuthField>

        {submitError && <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">{submitError}</p>}

        <button className="auth-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Đăng ký
        </button>
      </div>
    </form>
  );
}

function AuthField({
  label,
  required,
  icon,
  trailing,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  icon: ReactNode;
  trailing?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="auth-label">
        {label}
        {required && <span className="text-[#d8172a]"> *</span>}
      </span>
      <span className="auth-input-wrap">
        {icon}
        {children}
        {trailing}
      </span>
      {error && <span className="form-error">{error}</span>}
    </label>
  );
}

function PasswordToggle({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="auth-eye-btn"
      onClick={onClick}
      aria-label={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
    >
      {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}
