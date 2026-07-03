import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';

/** Restricts access to ADMIN role only. Redirects to /exams if not admin. */
export function AdminRoute() {
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'ADMIN') return <Navigate to="/exams" replace />;
  return <Outlet />;
}
