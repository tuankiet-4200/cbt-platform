import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { BookOpen, BarChart3, User, LogOut, Shield, ChevronRight, GraduationCap, Inbox } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useLogoutMutation } from '@/features/auth/api/useAuth';
import { cn } from '@/lib/utils';

interface RootLayoutProps {
  isAdmin?: boolean;
}

const userNavItems = [
  { to: '/exams',     label: 'Đề thi',      icon: BookOpen },
  { to: '/analytics', label: 'Phân tích',   icon: BarChart3 },
  { to: '/profile',   label: 'Tài khoản',   icon: User },
];

const adminNavItems = [
  { to: '/admin',              label: 'Dashboard',  icon: BarChart3 },
  { to: '/admin/questions',    label: 'Nội dung câu hỏi', icon: BookOpen },
  { to: '/admin/contributions', label: 'Đóng góp', icon: Inbox },
  { to: '/admin/exams',        label: 'Đề thi',     icon: GraduationCap },
  { to: '/admin/users',        label: 'Người dùng', icon: User },
  { to: '/admin/access-codes', label: 'Mã truy cập', icon: Shield },
  { to: '/admin/analytics',    label: 'Analytics', icon: BarChart3 },
];

export function RootLayout({ isAdmin = false }: RootLayoutProps) {
  const { user } = useAuthStore();
  const logoutMutation = useLogoutMutation();
  const navigate = useNavigate();
  const navItems = isAdmin ? adminNavItems : userNavItems;

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col fixed h-full z-30">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-neutral-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-neutral-900 text-sm leading-tight">CBT Platform</p>
              <p className="text-xs text-neutral-500">TSA HUST</p>
            </div>
          </div>
          {isAdmin && (
            <span className="mt-2 badge badge-primary block w-fit">Admin Panel</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary-50 text-primary-700 font-semibold'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('w-4 h-4', isActive ? 'text-primary-600' : 'text-neutral-400')} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 text-primary-400" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t border-neutral-200">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-primary-700 font-semibold text-xs">
                {user?.displayName?.[0]?.toUpperCase() ?? 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 truncate">{user?.displayName}</p>
              <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="flex items-center gap-3 px-3 py-2 w-full text-sm text-neutral-600
                       hover:bg-neutral-100 hover:text-danger-600 rounded-lg transition-all duration-150"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 ml-64 min-h-screen">
        <div className="page-container py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
