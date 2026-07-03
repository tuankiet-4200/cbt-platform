import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';

/** Redirects unauthenticated users to /login */
export function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
