import { Outlet } from 'react-router-dom';

/**
 * ExamLayout: Full-screen, distraction-free layout for active exam sessions.
 * - No sidebar, no navigation
 * - Overflow hidden to prevent accidental scrolling out of exam view
 * - The proctoring module will request fullscreen when mounted inside this layout
 */
export function ExamLayout() {
  return (
    <div className="exam-fullscreen" id="exam-container">
      <Outlet />
    </div>
  );
}
