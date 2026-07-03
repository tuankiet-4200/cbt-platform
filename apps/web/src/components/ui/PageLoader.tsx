import { cn } from '@/lib/utils';
import { GraduationCap } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <svg
      className={cn('animate-spin text-primary-600', sizeMap[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/** Full-page loader used as Suspense fallback */
export function PageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-neutral-50">
      <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center">
        <GraduationCap className="w-7 h-7 text-white" />
      </div>
      <Spinner size="lg" />
      <p className="text-neutral-500 text-sm animate-pulse-soft">Đang tải...</p>
    </div>
  );
}
