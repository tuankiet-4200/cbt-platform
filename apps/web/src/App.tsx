import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AxiosError } from 'axios';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { useAuthLogoutSync } from '@/features/auth/api/useAuth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 minutes
      retry: (failureCount, error: Error) => {
        // Don't retry on 401/403/404
        if (error instanceof AxiosError && [401, 403, 404].includes(error.response?.status ?? 0)) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: 0,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

function AppShell() {
  useAuthLogoutSync();
  return <RouterProvider router={router} />;
}
