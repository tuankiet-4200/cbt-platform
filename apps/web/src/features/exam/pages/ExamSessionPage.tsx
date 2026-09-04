import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Menu,
  Send,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { QuestionRenderer } from '../components/QuestionRenderer';
import { RichText } from '../components/RichText';
import {
  getAttempt,
  getSessionPayload,
  getSessionState,
  startCurrentSection,
  submitSection,
  syncSessionAnswers,
  type ExamSectionType,
  type SectionTransition,
  type SessionBundle,
  type SessionQuestion,
} from '../api/sessions.api';
import { useExamSessionStore } from '../store/exam-session.store';
import { useProctoringMonitor } from '../hooks/useProctoringMonitor';

const SECTION_LABELS: Record<ExamSectionType, string> = {
  MATH: 'Tư duy Toán học',
  READING: 'Tư duy Đọc hiểu',
  SCIENCE: 'Khoa học và giải quyết vấn đề',
};

export default function ExamSessionPage() {
  const { attemptId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [startedSessionId, setStartedSessionId] = useState<string | null>(null);
  const [transition, setTransition] = useState<SectionTransition | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [fullscreenWarning, setFullscreenWarning] = useState(false);
  const initializedSessionRef = useRef<string | null>(null);

  const attemptQuery = useQuery({
    queryKey: ['exam-attempt', attemptId],
    queryFn: () => getAttempt(attemptId),
    enabled: Boolean(attemptId),
    refetchOnWindowFocus: false,
  });

  const currentSection = attemptQuery.data?.sections.find(
    (section) => section.sectionType === attemptQuery.data?.currentSection,
  );
  const existingSession =
    currentSection?.session?.status === 'IN_PROGRESS'
      ? currentSection.session
      : null;
  const sessionId = startedSessionId ?? existingSession?.id ?? null;

  const startMutation = useMutation({
    mutationFn: () => startCurrentSection(attemptId),
    onSuccess: (session) => {
      setTransition(null);
      setStartedSessionId(session.sessionId);
      void queryClient.invalidateQueries({
        queryKey: ['exam-attempt', attemptId],
      });
    },
  });

  const payloadQuery = useQuery({
    queryKey: ['exam-session', sessionId, 'payload'],
    queryFn: () => getSessionPayload(sessionId ?? ''),
    enabled: Boolean(sessionId),
    refetchOnWindowFocus: false,
  });

  const stateQuery = useQuery({
    queryKey: ['exam-session', sessionId, 'state'],
    queryFn: () => getSessionState(sessionId ?? ''),
    enabled: Boolean(sessionId),
    refetchOnWindowFocus: false,
  });

  const initialize = useExamSessionStore((state) => state.initialize);
  useEffect(() => {
    if (
      !sessionId ||
      !stateQuery.data ||
      initializedSessionRef.current === sessionId
    ) {
      return;
    }
    initialize(sessionId, attemptId, stateQuery.data);
    initializedSessionRef.current = sessionId;
  }, [attemptId, initialize, sessionId, stateQuery.data]);

  useEffect(() => {
    const handleFullscreen = () => {
      if (sessionId && !document.fullscreenElement) {
        setFullscreenWarning(true);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreen);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreen);
  }, [sessionId]);

  const handleStart = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setFullscreenWarning(false);
    } catch {
      // Fullscreen can be denied by browser policy; the section still starts.
    }
    startMutation.mutate();
  };

  if (attemptQuery.isLoading) return <ExamLoading label="Đang tải bài thi..." />;

  if (attemptQuery.isError || !attemptQuery.data) {
    return (
      <ExamError
        message={getApiErrorMessage(
          attemptQuery.error,
          'Không thể tải lượt thi.',
        )}
        onBack={() => navigate('/exams')}
      />
    );
  }

  const isMultiSectionAttempt = attemptQuery.data.selectedSections.length > 1;

  if (isMultiSectionAttempt && (transition || !sessionId)) {
    return (
      <AttemptOverview
        attempt={attemptQuery.data}
        transition={transition}
        loading={startMutation.isPending}
        error={
          startMutation.isError
            ? getApiErrorMessage(
                startMutation.error,
                'Không thể bắt đầu phần thi.',
              )
            : null
        }
        onStart={handleStart}
        onBack={() => navigate(`/exams/${attemptQuery.data.exam.id}`)}
        onResults={() => navigate(`/results/${attemptId}`)}
      />
    );
  }

  if (attemptQuery.data.status !== 'IN_PROGRESS' && !transition) {
    return (
      <TransitionScreen
        title={attemptQuery.data.exam.title}
        completed
        nextSection={null}
        answeredCount={0}
        onContinue={() => navigate(`/results/${attemptId}`)}
      />
    );
  }

  if (transition) {
    return (
      <TransitionScreen
        title={attemptQuery.data.exam.title}
        completed={transition.completed}
        nextSection={transition.nextSection}
        answeredCount={transition.answeredCount}
        onContinue={async () => {
          if (transition.completed) {
            navigate(`/results/${transition.attemptId}`);
            return;
          }
          setTransition(null);
          setStartedSessionId(null);
          initializedSessionRef.current = null;
          await attemptQuery.refetch();
        }}
      />
    );
  }

  if (!sessionId) {
    if (!currentSection || !attemptQuery.data.currentSection) {
      return <ExamLoading label="Đang chuẩn bị phần thi tiếp theo..." />;
    }
    return (
      <SectionConfirmation
        examTitle={attemptQuery.data.exam.title}
        candidateName=""
        section={attemptQuery.data.currentSection}
        durationMins={currentSection.durationMins}
        questionCount={currentSection.questionCount}
        loading={startMutation.isPending}
        error={
          startMutation.isError
            ? getApiErrorMessage(
                startMutation.error,
                'Không thể bắt đầu phần thi.',
              )
            : null
        }
        onStart={handleStart}
        onBack={() => navigate(`/exams/${attemptQuery.data.exam.id}`)}
      />
    );
  }

  if (payloadQuery.isLoading || stateQuery.isLoading) {
    return <ExamLoading label="Đang kiểm tra thông tin bài thi..." />;
  }

  if (
    payloadQuery.isError ||
    stateQuery.isError ||
    !payloadQuery.data ||
    !stateQuery.data
  ) {
    return (
      <ExamError
        message={getApiErrorMessage(
          payloadQuery.error ?? stateQuery.error,
          'Không thể tải dữ liệu phần thi.',
        )}
        onBack={() => navigate('/exams')}
      />
    );
  }

  return (
    <ActiveExam
      payload={payloadQuery.data}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      submitOpen={submitOpen}
      setSubmitOpen={setSubmitOpen}
      onSubmitted={(result) => {
        if (document.fullscreenElement) void document.exitFullscreen();
        setStartedSessionId(null);
        initializedSessionRef.current = null;
        setTransition(result);
        setSubmitOpen(false);
        void queryClient.invalidateQueries({
          queryKey: ['exam-attempt', attemptId],
        });
      }}
      fullscreenWarning={fullscreenWarning}
      onResumeFullscreen={async () => {
        try {
          await document.documentElement.requestFullscreen();
          setFullscreenWarning(false);
        } catch {
          setFullscreenWarning(false);
        }
      }}
    />
  );
}

function ActiveExam({
  payload,
  sidebarOpen,
  setSidebarOpen,
  submitOpen,
  setSubmitOpen,
  onSubmitted,
  fullscreenWarning,
  onResumeFullscreen,
}: {
  payload: Awaited<ReturnType<typeof getSessionPayload>>;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  submitOpen: boolean;
  setSubmitOpen: (open: boolean) => void;
  onSubmitted: (transition: SectionTransition) => void;
  fullscreenWarning: boolean;
  onResumeFullscreen: () => void;
}) {
  const answers = useExamSessionStore((state) => state.answers);
  const timing = useExamSessionStore((state) => state.timing);
  const currentIndex = useExamSessionStore((state) => state.currentIndex);
  const dirtyQuestionIds = useExamSessionStore(
    (state) => state.dirtyQuestionIds,
  );
  const flaggedQuestionIds = useExamSessionStore(
    (state) => state.flaggedQuestionIds,
  );
  const connected = useExamSessionStore((state) => state.connected);
  const setAnswer = useExamSessionStore((state) => state.setAnswer);
  const setCurrentIndex = useExamSessionStore(
    (state) => state.setCurrentIndex,
  );
  const addTime = useExamSessionStore((state) => state.addTime);
  const markSynced = useExamSessionStore((state) => state.markSynced);
  const toggleFlag = useExamSessionStore((state) => state.toggleFlag);
  const setConnected = useExamSessionStore((state) => state.setConnected);
  const clearStore = useExamSessionStore((state) => state.clear);
  const questionStartedAt = useRef(Date.now());
  const questionTimingBase = useRef(0);
  const leavingExam = useRef(false);
  const [displayedQuestionTimeMs, setDisplayedQuestionTimeMs] = useState(0);
  const autoSubmitted = useRef(false);
  useProctoringMonitor({
    sessionId: payload.id,
    currentIndex,
    enabled: payload.status === 'IN_PROGRESS',
  });

  const flattened = useMemo(() => flattenQuestions(payload), [payload]);
  const safeIndex = Math.min(currentIndex, Math.max(0, flattened.length - 1));
  const active = flattened[safeIndex];
  const activeQuestionId = active?.question.id;
  const storedQuestionTimeMs = activeQuestionId
    ? (timing[activeQuestionId] ?? 0)
    : 0;
  const [remainingMs, setRemainingMs] = useState(
    Math.max(0, new Date(payload.endTime).getTime() - Date.now()),
  );
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const sidebarCollapsible = payload.layout === 'TWO_COLUMN';

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (activeQuestionId) {
        const now = Date.now();
        const elapsed = Math.max(0, now - questionStartedAt.current);
        if (elapsed > 0) addTime(activeQuestionId, elapsed);
        questionTimingBase.current += elapsed;
        questionStartedAt.current = now;
        setDisplayedQuestionTimeMs(questionTimingBase.current);
      }
      const current = useExamSessionStore.getState();
      const questionIds = current.dirtyQuestionIds.filter(
        (questionId) => current.answers[questionId],
      );
      if (questionIds.length > 0 && !navigator.onLine) {
        throw new Error(
          'Bạn đang ngoại tuyến. Vui lòng chờ kết nối lại trước khi nộp bài.',
        );
      }
      if (questionIds.length > 0 && navigator.onLine) {
        await syncSessionAnswers(
          payload.id,
          {
            currentIndex: current.currentIndex,
            answers: questionIds
              .filter((questionId) => current.answers[questionId])
              .map((questionId) => ({
                questionId,
                answerJson: current.answers[questionId],
                timeSpentMs: current.timing[questionId] ?? 0,
              })),
          },
          crypto.randomUUID(),
        );
        const latest = useExamSessionStore.getState();
        markSynced(
          questionIds.filter(
            (questionId) =>
              JSON.stringify(latest.answers[questionId]) ===
                JSON.stringify(current.answers[questionId]) &&
              latest.timing[questionId] === current.timing[questionId],
          ),
        );
      }
      return submitSection(payload.id);
    },
    onSuccess: (result) => {
      leavingExam.current = true;
      clearStore();
      onSubmitted(result);
    },
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemainingMs(
        Math.max(0, new Date(payload.endTime).getTime() - Date.now()),
      );
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [payload.endTime]);

  useEffect(() => {
    if (
      remainingMs === 0 &&
      connected &&
      !autoSubmitted.current &&
      !submitMutation.isPending
    ) {
      autoSubmitted.current = true;
      submitMutation.mutate();
    }
  }, [connected, remainingMs, submitMutation]);

  useEffect(() => {
    const handleOnline = () => {
      autoSubmitted.current = false;
      setConnected(true);
    };
    const handleOffline = () => setConnected(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setConnected]);

  useEffect(() => {
    if (!connected || dirtyQuestionIds.length === 0) return;
    const timer = window.setTimeout(async () => {
      const current = useExamSessionStore.getState();
      const questionIds = current.dirtyQuestionIds.filter(
        (questionId) => current.answers[questionId],
      );
      if (questionIds.length === 0) return;
      try {
        await syncSessionAnswers(
          payload.id,
          {
            currentIndex: current.currentIndex,
            answers: questionIds
              .filter((questionId) => current.answers[questionId])
              .map((questionId) => ({
                questionId,
                answerJson: current.answers[questionId],
                timeSpentMs: current.timing[questionId] ?? 0,
              })),
          },
          crypto.randomUUID(),
        );
        const latest = useExamSessionStore.getState();
        markSynced(
          questionIds.filter(
            (questionId) =>
              JSON.stringify(latest.answers[questionId]) ===
                JSON.stringify(current.answers[questionId]) &&
              latest.timing[questionId] === current.timing[questionId],
          ),
        );
      } catch {
        setConnected(navigator.onLine);
      }
    }, 3_000);
    return () => window.clearTimeout(timer);
  }, [
    connected,
    dirtyQuestionIds,
    markSynced,
    payload.id,
    setConnected,
  ]);

  useEffect(() => {
    if (!activeQuestionId) return;
    questionTimingBase.current =
      useExamSessionStore.getState().timing[activeQuestionId] ?? 0;
    questionStartedAt.current = Date.now();
    setDisplayedQuestionTimeMs(questionTimingBase.current);
    const interval = window.setInterval(() => {
      setDisplayedQuestionTimeMs(
        questionTimingBase.current + Date.now() - questionStartedAt.current,
      );
    }, 1_000);
    return () => {
      window.clearInterval(interval);
      if (!leavingExam.current) {
        addTime(activeQuestionId, Date.now() - questionStartedAt.current);
      }
    };
  }, [activeQuestionId, addTime]);

  useEffect(() => {
    if (!activeQuestionId || storedQuestionTimeMs <= questionTimingBase.current) {
      return;
    }
    const now = Date.now();
    questionTimingBase.current =
      storedQuestionTimeMs + now - questionStartedAt.current;
    questionStartedAt.current = now;
    setDisplayedQuestionTimeMs(questionTimingBase.current);
  }, [activeQuestionId, storedQuestionTimeMs]);

  const goTo = (index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, flattened.length - 1)));
  };

  if (!active) {
    return <ExamLoading label="Phần thi chưa có câu hỏi." />;
  }

  const answeredCount = flattened.filter(
    (item) => answers[item.question.id],
  ).length;
  const lowTime = remainingMs <= 5 * 60_000;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#f6f6f6]">
      <header className="flex h-16 shrink-0 items-center justify-between border-t-2 border-neutral-900 bg-white px-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <span className="text-4xl font-black tracking-tighter text-primary-700">
            TSA
          </span>
          <h1 className="truncate text-sm font-bold text-neutral-900 md:text-base">
            {payload.exam.title} - {SECTION_LABELS[payload.sectionType]}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className={`flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold lg:hidden ${
              sidebarCollapsible
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-700'
            }`}
            aria-label="Mở menu bài thi"
          >
            <Menu className="h-5 w-5" />
            Mở menu
          </button>
          {sidebarCollapsible && (
            <button
              type="button"
              onClick={() => setDesktopSidebarOpen((open) => !open)}
              className="hidden h-10 items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 lg:flex"
              aria-label={
                desktopSidebarOpen ? 'Đóng menu bài thi' : 'Mở menu bài thi'
              }
            >
              {desktopSidebarOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
              {desktopSidebarOpen ? 'Đóng menu' : 'Mở menu'}
            </button>
          )}
        </div>
      </header>

      <div
        className={`grid min-h-0 flex-1 ${
          desktopSidebarOpen
            ? 'lg:grid-cols-[minmax(0,1fr)_25rem]'
            : 'lg:grid-cols-1'
        }`}
      >
        <main className="min-h-0 overflow-hidden p-4">
          {payload.layout === 'TWO_COLUMN' ? (
            <div className="grid h-full min-h-0 gap-2 lg:grid-cols-2">
              <section className="overflow-y-auto rounded-lg bg-white p-5 text-sm leading-7 shadow-sm">
                <h2 className="mb-4 text-center font-bold text-neutral-800">
                  {active.bundle?.title ?? 'Bài đọc'}
                </h2>
                <RichText nodes={active.bundle?.content ?? []} />
              </section>
              <section className="overflow-y-auto rounded-lg bg-white shadow-sm">
                {active.bundle?.questions.map((question) => {
                  const questionIndex = flattened.findIndex(
                    (item) => item.question.id === question.id,
                  );
                  return (
                    <div
                      key={question.id}
                      onClick={() => {
                        if (questionIndex !== safeIndex) goTo(questionIndex);
                      }}
                      className={`border-b border-neutral-100 p-5 transition ${
                        questionIndex === safeIndex ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      <QuestionCard
                        number={questionIndex + 1}
                        question={question}
                        shuffleSeed={payload.attemptId}
                        answer={answers[question.id]}
                        onAnswer={(value) => setAnswer(question.id, value)}
                      />
                    </div>
                  );
                })}
              </section>
            </div>
          ) : (
            <section className="h-full overflow-y-auto rounded-lg bg-white p-5 shadow-sm">
              <QuestionCard
                number={safeIndex + 1}
                question={active.question}
                shuffleSeed={payload.attemptId}
                answer={answers[active.question.id]}
                onAnswer={(value) => setAnswer(active.question.id, value)}
              />
            </section>
          )}
        </main>

        <ExamSidebar
          open={sidebarOpen}
          desktopOpen={desktopSidebarOpen}
          onClose={() => setSidebarOpen(false)}
          candidateName={payload.candidate.displayName}
          remainingMs={remainingMs}
          lowTime={lowTime}
          answeredCount={answeredCount}
          total={flattened.length}
          currentIndex={safeIndex}
          answers={answers}
          flaggedQuestionIds={flaggedQuestionIds}
          questions={flattened.map((item) => item.question)}
          connected={connected}
          onGoTo={(index) => {
            goTo(index);
            setSidebarOpen(false);
          }}
          onSubmit={() => setSubmitOpen(true)}
        />
      </div>

      <footer className="flex h-16 shrink-0 items-center justify-between border-t border-neutral-200 bg-white px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goTo(safeIndex - 1)}
            disabled={safeIndex === 0}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 disabled:opacity-40"
            aria-label="Câu trước"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => goTo(safeIndex + 1)}
            disabled={safeIndex === flattened.length - 1}
            className="flex h-10 items-center gap-2 rounded-md bg-[#17386d] px-5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Câu tiếp
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="hidden items-center gap-5 text-sm text-neutral-600 sm:flex">
          <button
            type="button"
            onClick={() => toggleFlag(active.question.id)}
            className={`rounded-md border px-3 py-2 text-xs font-semibold ${
              flaggedQuestionIds.includes(active.question.id)
                ? 'border-warning-300 bg-warning-50 text-warning-700'
                : 'border-neutral-200 text-neutral-500'
            }`}
          >
            {flaggedQuestionIds.includes(active.question.id)
              ? 'Đã đánh dấu'
              : 'Đánh dấu xem lại'}
          </button>
          <span>Thời gian làm câu hiện tại</span>
          <span className="font-mono text-xl text-[#17386d]">
            {formatDuration(displayedQuestionTimeMs)}
          </span>
        </div>
      </footer>

      {submitOpen && (
        <SubmitDialog
          answered={answeredCount}
          total={flattened.length}
          loading={submitMutation.isPending}
          error={
            submitMutation.isError
              ? getApiErrorMessage(
                  submitMutation.error,
                  'Không thể nộp phần thi.',
                )
              : null
          }
          onClose={() => setSubmitOpen(false)}
          onSubmit={() => submitMutation.mutate()}
        />
      )}

      {fullscreenWarning && (
        <ModalOverlay>
          <div className="w-full max-w-xl rounded-lg bg-white p-6 text-center shadow-2xl">
            <AlertTriangle className="mx-auto h-10 w-10 text-warning-500" />
            <p className="mt-4 text-sm leading-6 text-neutral-700">
              Chế độ hiển thị toàn màn hình đã bị tắt.
              <br />
              Ấn “Tiếp tục” để kích hoạt và trở lại màn hình làm bài.
            </p>
            <button
              type="button"
              onClick={onResumeFullscreen}
              className="btn btn-primary mt-5 w-full"
            >
              Tiếp tục
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

function QuestionCard({
  number,
  question,
  shuffleSeed,
  answer,
  onAnswer,
}: {
  number: number;
  question: SessionQuestion;
  shuffleSeed: string;
  answer?: Record<string, unknown>;
  onAnswer: (answer: Record<string, unknown>) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-700">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <QuestionRenderer
          question={question}
          shuffleSeed={shuffleSeed}
          answer={answer}
          onAnswer={onAnswer}
        />
      </div>
    </div>
  );
}

function ExamSidebar({
  open,
  desktopOpen,
  onClose,
  candidateName,
  remainingMs,
  lowTime,
  answeredCount,
  total,
  currentIndex,
  answers,
  flaggedQuestionIds,
  questions,
  connected,
  onGoTo,
  onSubmit,
}: {
  open: boolean;
  desktopOpen: boolean;
  onClose: () => void;
  candidateName: string;
  remainingMs: number;
  lowTime: boolean;
  answeredCount: number;
  total: number;
  currentIndex: number;
  answers: Record<string, Record<string, unknown>>;
  flaggedQuestionIds: string[];
  questions: SessionQuestion[];
  connected: boolean;
  onGoTo: (index: number) => void;
  onSubmit: () => void;
}) {
  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-neutral-950/50 lg:hidden"
          onClick={onClose}
          aria-label="Đóng menu"
        />
      )}
      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-[min(25rem,92vw)] flex-col bg-white p-5 shadow-2xl transition-transform ${
          desktopOpen
            ? 'lg:static lg:z-auto lg:w-auto lg:translate-x-0 lg:border-l lg:border-neutral-200 lg:shadow-none'
            : 'lg:hidden'
        } ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 lg:hidden"
          aria-label="Đóng menu"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-semibold text-neutral-800">Thông tin thí sinh</h2>
        <div className="mt-3 flex justify-between text-sm text-neutral-500">
          <span>Họ tên</span>
          <span className="font-medium text-neutral-700">{candidateName}</span>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <div className="flex flex-1 items-center justify-between rounded-md border border-neutral-200 px-3 py-2">
            <span className="text-sm text-neutral-600">Thời gian còn lại</span>
            <span
              className={`font-mono text-2xl ${
                lowTime ? 'text-primary-600' : 'text-[#17386d]'
              }`}
            >
              {formatCountdown(remainingMs)}
            </span>
          </div>
          <button
            type="button"
            onClick={onSubmit}
            className="h-10 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Nộp bài
          </button>
        </div>

        <div className="mt-8">
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <span>Chỉ thị màu sắc:</span>
            <span className="rounded-full bg-neutral-100 px-2 py-1">
              {total - answeredCount}
            </span>
            <span className="rounded-full bg-blue-500 px-2 py-1 text-white">
              {answeredCount}
            </span>
            <span className="rounded-full bg-warning-400 px-2 py-1 text-white">
              {flaggedQuestionIds.length}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-8 gap-3">
            {questions.map((question, index) => {
              const answered = Boolean(answers[question.id]);
              return (
                <button
                  type="button"
                  key={question.id}
                  onClick={() => onGoTo(index)}
                  className={`flex aspect-square items-center justify-center rounded-full text-xs font-semibold transition ${
                    index === currentIndex
                      ? 'bg-[#0e2b59] text-white'
                      : flaggedQuestionIds.includes(question.id)
                        ? 'bg-warning-400 text-white'
                      : answered
                        ? 'bg-blue-500 text-white'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-auto border-t border-neutral-200 pt-4">
          <div className="flex items-end justify-between">
            <span className="text-sm text-neutral-600">Bạn đã hoàn thành</span>
            <span className="text-2xl text-[#17386d]">
              {answeredCount}/{total}{' '}
              <small className="text-xs text-neutral-600">câu</small>
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full bg-primary-600 transition-all"
              style={{ width: `${total ? (answeredCount / total) * 100 : 0}%` }}
            />
          </div>
          <div
            className={`mt-4 flex items-center gap-2 text-sm ${
              connected ? 'text-success-500' : 'text-warning-600'
            }`}
          >
            {connected ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            {connected ? 'Đã kết nối máy chủ' : 'Đang lưu ngoại tuyến'}
          </div>
        </div>
      </aside>
    </>
  );
}

function SectionConfirmation({
  examTitle,
  section,
  durationMins,
  questionCount,
  loading,
  error,
  onStart,
  onBack,
}: {
  examTitle: string;
  candidateName: string;
  section: ExamSectionType;
  durationMins: number;
  questionCount: number;
  loading: boolean;
  error: string | null;
  onStart: () => void;
  onBack: () => void;
}) {
  return (
    <div className="auth-screen flex min-h-dvh items-center justify-center p-5">
      <div className="auth-bg-map" />
      <div className="auth-bg-lines" />
      <section className="relative z-10 w-full max-w-[30rem] rounded-lg bg-white p-7 shadow-xl">
        <div className="text-center">
          <div className="text-5xl font-black tracking-tighter text-primary-700">
            TSA
          </div>
          <p className="mt-1 text-xs font-bold uppercase text-neutral-800">
            Bài thi đánh giá tư duy
          </p>
          <h1 className="mt-5 text-xl font-medium text-neutral-800">
            Xác nhận thông tin dự thi
          </h1>
        </div>
        <dl className="mt-5 grid grid-cols-[7rem_minmax(0,1fr)] gap-y-3 text-sm">
          <dt className="text-neutral-500">Kỳ thi</dt>
          <dd className="font-medium text-neutral-700">{examTitle}</dd>
          <dt className="text-neutral-500">Phần thi</dt>
          <dd className="font-medium text-neutral-700">
            {SECTION_LABELS[section]}
          </dd>
          <dt className="text-neutral-500">Số câu</dt>
          <dd className="font-medium text-neutral-700">{questionCount} câu</dd>
          <dt className="text-neutral-500">Thời gian</dt>
          <dd className="font-medium text-neutral-700">{durationMins} phút</dd>
        </dl>
        <p className="mt-5 text-sm italic leading-6 text-neutral-700">
          Lưu ý: Bằng việc nhấn nút “Bắt đầu thi”, hệ thống sẽ bắt đầu tính
          giờ cho phần thi này.
        </p>
        {loading ? (
          <div className="mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-500" />
            </div>
            <p className="mt-3 text-center text-sm text-neutral-600">
              Đang kiểm tra thông tin bài thi...
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={onStart}
            className="btn btn-primary mt-5 w-full"
          >
            Bắt đầu thi
          </button>
        )}
        {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
        <button
          type="button"
          onClick={onBack}
          className="mt-4 text-sm text-primary-600 underline"
        >
          Quay lại
        </button>
      </section>
    </div>
  );
}

function AttemptOverview({
  attempt,
  transition,
  loading,
  error,
  onStart,
  onBack,
  onResults,
}: {
  attempt: Awaited<ReturnType<typeof getAttempt>>;
  transition: SectionTransition | null;
  loading: boolean;
  error: string | null;
  onStart: () => void;
  onBack: () => void;
  onResults: () => void;
}) {
  const completed = transition?.completed || attempt.status !== 'IN_PROGRESS';
  const currentSection = transition?.nextSection ?? attempt.currentSection;
  const breakEndsAt = transition?.breakEndsAt ?? attempt.breakEndsAt ?? null;
  const [breakRemainingMs, setBreakRemainingMs] = useState(() =>
    breakEndsAt ? Math.max(0, new Date(breakEndsAt).getTime() - Date.now()) : 0,
  );
  const autoStarted = useRef(false);
  const submittedSections = new Set(
    attempt.sections
      .filter(
        (section) =>
          section.session && section.session.status !== 'IN_PROGRESS',
      )
      .map((section) => section.sectionType),
  );
  if (transition?.submittedSection) {
    submittedSections.add(transition.submittedSection);
  }

  useEffect(() => {
    if (!breakEndsAt) {
      setBreakRemainingMs(0);
      return;
    }
    const update = () =>
      setBreakRemainingMs(
        Math.max(0, new Date(breakEndsAt).getTime() - Date.now()),
      );
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [breakEndsAt]);

  useEffect(() => {
    if (
      !breakEndsAt ||
      breakRemainingMs > 0 ||
      completed ||
      !currentSection ||
      loading ||
      autoStarted.current
    ) {
      return;
    }
    autoStarted.current = true;
    onStart();
  }, [
    breakEndsAt,
    breakRemainingMs,
    completed,
    currentSection,
    loading,
    onStart,
  ]);

  return (
    <div className="auth-screen min-h-dvh px-4 py-10 sm:py-16">
      <div className="auth-bg-map" />
      <div className="auth-bg-lines" />
      <section className="relative z-10 mx-auto w-full max-w-5xl rounded-2xl bg-white p-6 shadow-xl sm:p-10">
        <div className="text-center">
          <div className="text-5xl font-black tracking-tighter text-primary-700">
            TSA
          </div>
          <p className="mt-2 text-sm font-semibold text-neutral-500">
            {attempt.exam.title}
          </p>
          <h1 className="mt-7 text-2xl font-bold text-neutral-900">
            Danh sách phần thi
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Hoàn thành lần lượt từng phần theo đúng thời gian quy định.
          </p>
        </div>

        {breakEndsAt && !completed && currentSection && (
          <div className="mx-auto mt-6 max-w-xl rounded-xl border border-primary-100 bg-primary-50 px-5 py-4 text-center">
            <p className="text-sm font-semibold text-primary-800">
              Thời gian nghỉ trước phần tiếp theo
            </p>
            <p className="mt-1 font-mono text-3xl font-bold text-primary-700">
              {formatCountdown(breakRemainingMs)}
            </p>
            <p className="mt-1 text-xs text-primary-600">
              Hết giờ nghỉ, phần tiếp theo sẽ tự động bắt đầu.
            </p>
          </div>
        )}

        <div className="mt-7 overflow-hidden rounded-xl border border-neutral-200">
          {attempt.sections.map((section, index) => {
            const isDone = submittedSections.has(section.sectionType);
            const isCurrent =
              !completed && section.sectionType === currentSection;
            return (
              <div
                key={section.sectionType}
                className="grid gap-4 border-b border-neutral-200 p-5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_8rem] md:items-center"
              >
                <div>
                  <h2
                    className={`font-bold ${
                      isCurrent
                        ? 'text-primary-700'
                        : isDone
                          ? 'text-success-700'
                          : 'text-neutral-500'
                    }`}
                  >
                    {index + 1}. TSA - Phần thi {SECTION_LABELS[section.sectionType]}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-600">
                    <span>
                      <strong>Số câu:</strong> {section.questionCount}
                    </span>
                    <span>
                      <strong>Thời gian:</strong> {section.durationMins} phút
                    </span>
                    <span>
                      <strong>Trạng thái:</strong>{' '}
                      <span
                        className={
                          isDone
                            ? 'text-success-600'
                            : isCurrent
                              ? 'text-primary-600'
                              : 'text-neutral-400'
                        }
                      >
                        {isDone
                          ? 'Đã hoàn thành'
                          : isCurrent
                            ? breakRemainingMs > 0
                              ? 'Đang nghỉ'
                              : 'Sẵn sàng'
                            : 'Chưa mở'}
                      </span>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!isCurrent || loading}
                  onClick={onStart}
                  className={`h-11 rounded-lg px-5 text-sm font-semibold transition ${
                    isCurrent
                      ? 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60'
                      : 'border border-neutral-200 bg-neutral-50 text-neutral-400'
                  }`}
                >
                  {loading && isCurrent
                    ? 'Đang mở...'
                    : isDone
                      ? 'Hoàn thành'
                      : isCurrent
                        ? breakRemainingMs > 0
                          ? 'Tiếp tục ngay'
                          : 'Bắt đầu'
                        : 'Chưa mở'}
                </button>
              </div>
            );
          })}
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-danger-600">{error}</p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium text-primary-700 underline"
          >
            Về thư viện đề thi
          </button>
          {completed && (
            <button
              type="button"
              onClick={onResults}
              className="btn btn-primary"
            >
              Xem kết quả <ArrowRight className="h-4 w-4" />
            </button>
          )}
          <span className="text-sm text-neutral-500">
            Đã hoàn thành {submittedSections.size}/{attempt.sections.length} phần
          </span>
        </div>
      </section>
    </div>
  );
}

function TransitionScreen({
  title,
  completed,
  nextSection,
  answeredCount,
  onContinue,
}: {
  title: string;
  completed: boolean;
  nextSection: ExamSectionType | null;
  answeredCount: number;
  onContinue: () => void;
}) {
  return (
    <div className="auth-screen flex min-h-dvh items-center justify-center p-5">
      <div className="auth-bg-map" />
      <div className="auth-bg-lines" />
      <section className="relative z-10 w-full max-w-[31rem] rounded-lg bg-white p-7 shadow-xl">
        <div className="text-center">
          <div className="text-5xl font-black tracking-tighter text-primary-700">
            TSA
          </div>
          <CheckCircle2 className="mx-auto mt-5 h-12 w-12 text-success-500" />
          <h1 className="mt-3 text-xl font-bold text-neutral-900">
            {completed ? 'Đã hoàn thành bài thi' : 'Đã hoàn thành phần thi'}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">{title}</p>
        </div>
        <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">Số câu đã trả lời</span>
            <strong>{answeredCount}</strong>
          </div>
          {!completed && nextSection && (
            <div className="mt-3 flex justify-between border-t pt-3">
              <span className="text-neutral-500">Phần tiếp theo</span>
              <strong>{SECTION_LABELS[nextSection]}</strong>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onContinue}
          className="btn btn-primary mt-5 w-full"
        >
          {completed ? 'Về thư viện đề thi' : 'Tiếp tục'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>
    </div>
  );
}

function SubmitDialog({
  answered,
  total,
  loading,
  error,
  onClose,
  onSubmit,
}: {
  answered: number;
  total: number;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <ModalOverlay>
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 text-center shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-9 left-1/2 -translate-x-1/2 rounded-full bg-white p-1 text-neutral-500"
          aria-label="Đóng"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="mx-auto flex h-20 w-20 flex-col items-center justify-center rounded-full bg-warning-400 font-bold text-white">
          <span className="text-lg">
            {answered}/{total}
          </span>
          <span className="text-xs">câu</span>
        </div>
        <p className="mt-5 text-sm font-semibold leading-6 text-neutral-700">
          Đã trả lời {answered}/{total} câu. Bạn vẫn còn thời gian làm bài, bạn
          có chắc chắn muốn kết thúc phần thi?
        </p>
        {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-md bg-[#17386d] text-sm font-semibold text-white"
          >
            Làm bài tiếp
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className="flex h-11 items-center justify-center gap-2 rounded-md bg-primary-600 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Nộp bài thi
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function ModalOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/55 p-5 backdrop-blur-[1px]">
      {children}
    </div>
  );
}

function ExamLoading({ label }: { label: string }) {
  return (
    <div className="auth-screen flex min-h-dvh items-center justify-center">
      <div className="auth-bg-map" />
      <div className="relative z-10 rounded-lg bg-white px-10 py-8 text-center shadow-xl">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-600" />
        <p className="mt-4 text-sm text-neutral-600">{label}</p>
      </div>
    </div>
  );
}

function ExamError({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-50 p-5">
      <div className="w-full max-w-md rounded-lg bg-white p-7 text-center shadow-xl">
        <AlertTriangle className="mx-auto h-10 w-10 text-danger-500" />
        <h1 className="mt-4 text-lg font-bold">Không thể mở bài thi</h1>
        <p className="mt-2 text-sm text-neutral-500">{message}</p>
        <button
          type="button"
          onClick={onBack}
          className="btn btn-secondary mt-5"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </button>
      </div>
    </div>
  );
}

function flattenQuestions(payload: {
  questions: SessionQuestion[];
  bundles: SessionBundle[];
}) {
  if (payload.questions.length > 0) {
    return payload.questions.map((question) => ({
      question,
      bundle: null as SessionBundle | null,
    }));
  }
  return payload.bundles.flatMap((bundle) =>
    bundle.questions.map((question) => ({ question, bundle })),
  );
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1_000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (message) return message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
