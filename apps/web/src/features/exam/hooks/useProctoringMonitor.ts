import { useEffect, useRef } from 'react';
import {
  recordProctoringEvents,
  type ProctoringEventInput,
  type ProctoringEventType,
} from '../api/sessions.api';

export function useProctoringMonitor({
  sessionId,
  currentIndex,
  enabled,
}: {
  sessionId: string;
  currentIndex: number;
  enabled: boolean;
}) {
  const buffer = useRef<ProctoringEventInput[]>([]);
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  useEffect(() => {
    if (!enabled) return;

    const record = (
      eventType: ProctoringEventType,
      metadata?: Record<string, unknown>,
    ) => {
      buffer.current.push({
        eventType,
        occurredAt: new Date().toISOString(),
        metadata: {
          currentIndex: currentIndexRef.current,
          ...metadata,
        },
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        record('TAB_SWITCH', { visibilityState: document.visibilityState });
      }
    };
    const handleFullscreen = () => {
      if (!document.fullscreenElement) record('FULLSCREEN_EXIT');
    };
    const handleCopy = () => record('COPY_ATTEMPT');
    const handleBlur = () => record('SESSION_BLUR');

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFullscreen);
    document.addEventListener('copy', handleCopy);
    window.addEventListener('blur', handleBlur);

    const flush = async () => {
      if (!navigator.onLine || buffer.current.length === 0) return;
      const batch = buffer.current.splice(0, 50);
      try {
        await recordProctoringEvents(sessionId, batch);
      } catch {
        buffer.current = [...batch, ...buffer.current].slice(0, 200);
      }
    };
    const interval = window.setInterval(() => void flush(), 10_000);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      document.removeEventListener('copy', handleCopy);
      window.removeEventListener('blur', handleBlur);
      void flush();
    };
  }, [enabled, sessionId]);
}
