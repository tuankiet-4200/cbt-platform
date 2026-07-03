import { Outlet, Navigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store/auth.store';

export function AuthLayout() {
  const { isAuthenticated } = useAuthStore();

  // Already authenticated → redirect to app
  if (isAuthenticated) {
    return <Navigate to="/exams" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-accent-700 flex">
      {/* ── Left: Branding ──────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 text-white">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-lg">CBT Platform</p>
            <p className="text-primary-300 text-sm">TSA HUST Simulation</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            Luyện thi TSA<br />
            <span className="text-primary-300">Bách Khoa Hà Nội</span><br />
            thông minh hơn
          </h1>
          <p className="text-primary-200 text-lg leading-relaxed max-w-md">
            Hệ thống thi thử mô phỏng chính xác kỳ thi Đánh giá tư duy — 
            với phân tích chi tiết giúp bạn biết chính xác điểm cần cải thiện.
          </p>

          {/* Features */}
          <ul className="space-y-3">
            {[
              '✓ Đề thi được tuyển chọn và chuẩn hóa',
              '✓ Phân tích chi tiết từng câu hỏi',
              '✓ Tự động lưu bài khi mất mạng',
              '✓ Miễn phí cho cộng đồng',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-primary-100">
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-primary-400 text-sm">
          © {new Date().getFullYear()} CBT Platform. Cộng đồng học sinh Bách Khoa.
        </p>
      </div>

      {/* ── Right: Auth Form ─────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <p className="font-bold text-white text-lg">CBT Platform</p>
          </div>

          <div className="card p-8 shadow-2xl animate-slide-up">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
