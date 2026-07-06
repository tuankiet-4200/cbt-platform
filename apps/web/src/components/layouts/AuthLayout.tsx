import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useAuthBootstrap } from '@/features/auth/api/useAuth';
import { PageLoader } from '@/components/ui/PageLoader';

export function AuthLayout() {
  const { user, isAuthenticated } = useAuthStore();
  const { isBootstrapping } = useAuthBootstrap(!isAuthenticated);

  if (isBootstrapping) return <PageLoader />;

  // Already authenticated → redirect to app
  if (isAuthenticated) {
    return <Navigate to={user?.role === 'ADMIN' ? '/admin' : '/exams'} replace />;
  }

  return (
    <div className="auth-screen">
      <div className="auth-bg-map" />
      <div className="auth-bg-lines" />

      <main className="relative z-10 flex min-h-screen flex-col items-center px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-center gap-3 sm:mb-7">
          <div className="text-[2.15rem] font-extrabold leading-none text-[#d8172a] sm:text-[2.6rem]">
            TSA
          </div>
          <div className="leading-tight">
            <p className="text-[0.72rem] font-semibold uppercase text-[#d8172a] sm:text-xs">
              Đại học Bách Khoa Hà Nội
            </p>
            <p className="text-sm font-extrabold uppercase text-neutral-900 sm:text-lg">
              Kỳ thi đánh giá tư duy
            </p>
          </div>
        </div>

        <section className="auth-panel">
            <Outlet />
        </section>
      </main>
    </div>
  );
}
