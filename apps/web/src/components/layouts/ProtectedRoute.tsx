import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useAuthBootstrap } from '@/features/auth/api/useAuth';
import { PageLoader } from '@/components/ui/PageLoader';

/** Redirects unauthenticated users to /login */
export function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore();
  const { isBootstrapping } = useAuthBootstrap(!isAuthenticated);

  if (isBootstrapping) return <PageLoader />;

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
