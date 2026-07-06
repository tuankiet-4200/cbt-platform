import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Lock, Loader2, Mail } from 'lucide-react';
import { useLoginMutation } from '../api/useAuth';

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const loginMutation = useLoginMutation();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register: registerField,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginForm) => {
    setSubmitError(null);
    try {
      const session = await loginMutation.mutateAsync(values);
      navigate(session.user.role === 'ADMIN' ? '/admin' : '/exams', { replace: true });
    } catch {
      setSubmitError('Email hoặc mật khẩu không chính xác');
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-5 text-center">
        <h1 className="text-3xl font-semibold text-neutral-900">Đăng nhập</h1>
        <p className="text-sm text-neutral-700">
          Bạn chưa có tài khoản?{' '}
          <Link className="font-medium text-[#d8172a] hover:text-[#b91222]" to="/register">
            Đăng ký ngay
          </Link>
        </p>
      </div>

      <div className="space-y-5 pt-5">
        <label className="block">
          <span className="auth-label">Email <span className="text-[#d8172a]">*</span></span>
          <span className="auth-input-wrap">
            <Mail className="h-4 w-4 text-neutral-500" />
            <input
              className="auth-input"
              type="email"
              autoComplete="email"
              placeholder="email@example.com"
              {...registerField('email')}
            />
          </span>
          {errors.email && <span className="form-error">{errors.email.message}</span>}
        </label>

        <label className="block">
          <span className="auth-label">Mật khẩu <span className="text-[#d8172a]">*</span></span>
          <span className="auth-input-wrap">
            <Lock className="h-4 w-4 text-neutral-500" />
            <input
              className="auth-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu"
              {...registerField('password')}
            />
            <button
              type="button"
              className="auth-eye-btn"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </span>
          {errors.password && <span className="form-error">{errors.password.message}</span>}
        </label>

        {submitError && <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">{submitError}</p>}

        <button className="auth-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Đăng nhập
        </button>

        <Link className="inline-block text-sm font-medium text-[#d8172a] hover:text-[#b91222]" to="/forgot-password">
          Quên mật khẩu?
        </Link>
      </div>
    </form>
  );
}
