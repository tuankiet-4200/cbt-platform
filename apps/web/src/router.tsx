import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { RootLayout } from '@/components/layouts/RootLayout';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { ExamLayout } from '@/components/layouts/ExamLayout';
import { ProtectedRoute } from '@/components/layouts/ProtectedRoute';
import { AdminRoute } from '@/components/layouts/AdminRoute';
import { PageLoader } from '@/components/ui/PageLoader';

// ── Lazy-loaded pages ─────────────────────────────────────────────────────
const LoginPage         = lazy(() => import('@/features/auth/pages/LoginPage'));
const RegisterPage      = lazy(() => import('@/features/auth/pages/RegisterPage'));
const ExamLibraryPage   = lazy(() => import('@/features/exams/pages/ExamLibraryPage'));
const ExamDetailPage    = lazy(() => import('@/features/exams/pages/ExamDetailPage'));
const ExamSessionPage   = lazy(() => import('@/features/exam/pages/ExamSessionPage'));
const ResultPage        = lazy(() => import('@/features/results/pages/ResultPage'));
const ResultReviewPage  = lazy(() => import('@/features/results/pages/ResultReviewPage'));
const AnalyticsPage     = lazy(() => import('@/features/analytics/pages/AnalyticsPage'));
const ProfilePage       = lazy(() => import('@/features/profile/pages/ProfilePage'));
// Admin
const AdminDashboard    = lazy(() => import('@/features/admin/pages/AdminDashboard'));
const AdminQuestionsPage = lazy(() => import('@/features/admin/pages/AdminQuestionsPage'));
const AdminQuestionEditorPage = lazy(() => import('@/features/admin/pages/AdminQuestionEditorPage'));
const AdminTagsPage = lazy(() => import('@/features/admin/pages/AdminTagsPage'));
const AdminTagEditorPage = lazy(() => import('@/features/admin/pages/AdminTagEditorPage'));
const AdminContributionsPage = lazy(() => import('@/features/admin/pages/AdminContributionsPage'));
const AdminExamBlueprintsPage = lazy(() => import('@/features/admin/pages/AdminExamBlueprintsPage'));
const AdminExamsPage    = lazy(() => import('@/features/admin/pages/AdminExamsPage'));
const AdminExamCreatePage = lazy(() => import('@/features/admin/pages/AdminExamCreatePage'));
const AdminUsersPage    = lazy(() => import('@/features/admin/pages/AdminUsersPage'));
const AdminCodesPage    = lazy(() => import('@/features/admin/pages/AdminCodesPage'));

const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

export const router = createBrowserRouter([
  // ── Auth Routes (unauthenticated only) ──────────────────────────────────
  {
    element: <AuthLayout />,
    children: [
      { path: '/login',    element: withSuspense(LoginPage) },
      { path: '/register', element: withSuspense(RegisterPage) },
    ],
  },

  // ── Protected App Routes ─────────────────────────────────────────────────
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <RootLayout />,
        children: [
          { index: true,          element: <Navigate to="/exams" replace /> },
          { path: '/exams',       element: withSuspense(ExamLibraryPage) },
          { path: '/exams/:id',   element: withSuspense(ExamDetailPage) },
          { path: '/results/:sessionId',        element: withSuspense(ResultPage) },
          { path: '/results/:sessionId/review', element: withSuspense(ResultReviewPage) },
          { path: '/analytics',   element: withSuspense(AnalyticsPage) },
          { path: '/profile',     element: withSuspense(ProfilePage) },
        ],
      },

      // ── Exam Session (full-screen, no nav) ─────────────────────────────
      {
        element: <ExamLayout />,
        children: [
          { path: '/exam/:sessionId', element: withSuspense(ExamSessionPage) },
        ],
      },

      // ── Admin Routes ───────────────────────────────────────────────────
      {
        element: <AdminRoute />,
        children: [
          {
            element: <RootLayout isAdmin />,
            children: [
              { path: '/admin',                element: withSuspense(AdminDashboard) },
              { path: '/admin/questions',      element: withSuspense(AdminQuestionsPage) },
              { path: '/admin/questions/create', element: withSuspense(AdminQuestionEditorPage) },
              { path: '/admin/questions/:questionId/edit', element: withSuspense(AdminQuestionEditorPage) },
              { path: '/admin/questions/bundles/:bundleId/edit', element: withSuspense(AdminQuestionEditorPage) },
              { path: '/admin/tags',           element: withSuspense(AdminTagsPage) },
              { path: '/admin/tags/create',    element: withSuspense(AdminTagEditorPage) },
              { path: '/admin/tags/:tagId/edit', element: withSuspense(AdminTagEditorPage) },
              { path: '/admin/passage-bundles', element: <Navigate to="/admin/questions" replace /> },
              { path: '/admin/contributions',  element: withSuspense(AdminContributionsPage) },
              { path: '/admin/exam-blueprints', element: withSuspense(AdminExamBlueprintsPage) },
              { path: '/admin/exams',          element: withSuspense(AdminExamsPage) },
              { path: '/admin/exams/create',   element: withSuspense(AdminExamCreatePage) },
              { path: '/admin/users',          element: withSuspense(AdminUsersPage) },
              { path: '/admin/access-codes',   element: withSuspense(AdminCodesPage) },
              { path: '/admin/analytics',      element: withSuspense(AnalyticsPage) },
            ],
          },
        ],
      },
    ],
  },

  // ── Catch-all ────────────────────────────────────────────────────────────
  { path: '*', element: <Navigate to="/exams" replace /> },
]);
