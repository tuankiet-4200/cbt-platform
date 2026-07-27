import { create } from 'zustand';

type Answer = Record<string, unknown>;

interface PersistedSessionState {
  attemptId: string;
  answers: Record<string, Answer>;
  timing: Record<string, number>;
  currentIndex: number;
  dirtyQuestionIds: string[];
  flaggedQuestionIds: string[];
}

interface ExamSessionState extends PersistedSessionState {
  sessionId: string | null;
  connected: boolean;
  initialize: (
    sessionId: string,
    attemptId: string,
    recovered: {
      answers: Record<string, Answer>;
      timing: Record<string, number>;
      currentIndex: number;
    },
  ) => void;
  setAnswer: (questionId: string, answer: Answer) => void;
  setCurrentIndex: (index: number) => void;
  addTime: (questionId: string, milliseconds: number) => void;
  markSynced: (questionIds: string[]) => void;
  toggleFlag: (questionId: string) => void;
  setConnected: (connected: boolean) => void;
  clear: () => void;
}

const emptyState = {
  sessionId: null,
  attemptId: '',
  answers: {},
  timing: {},
  currentIndex: 0,
  dirtyQuestionIds: [],
  flaggedQuestionIds: [],
  connected: navigator.onLine,
};

function storageKey(sessionId: string) {
  return `exam_session_${sessionId}`;
}

function attemptFlagsKey(attemptId: string) {
  return `exam_attempt_flags_${attemptId}`;
}

export function readAttemptFlaggedQuestionIds(attemptId: string): string[] {
  if (!attemptId) return [];
  try {
    const raw = localStorage.getItem(attemptFlagsKey(attemptId));
    const value: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function persistAttemptFlags(attemptId: string, questionIds: string[]) {
  if (!attemptId) return;
  localStorage.setItem(
    attemptFlagsKey(attemptId),
    JSON.stringify(questionIds),
  );
}

function readPersisted(sessionId: string): PersistedSessionState | null {
  try {
    const raw = localStorage.getItem(storageKey(sessionId));
    return raw ? (JSON.parse(raw) as PersistedSessionState) : null;
  } catch {
    return null;
  }
}

function persistCurrent(get: () => ExamSessionState) {
  const state = get();
  if (!state.sessionId) return;
  const persisted: PersistedSessionState = {
    attemptId: state.attemptId,
    answers: state.answers,
    timing: state.timing,
    currentIndex: state.currentIndex,
    dirtyQuestionIds: state.dirtyQuestionIds,
    flaggedQuestionIds: state.flaggedQuestionIds,
  };
  localStorage.setItem(storageKey(state.sessionId), JSON.stringify(persisted));
}

export const useExamSessionStore = create<ExamSessionState>((set, get) => ({
  ...emptyState,
  initialize: (sessionId, attemptId, recovered) => {
    const local = readPersisted(sessionId);
    set({
      sessionId,
      attemptId,
      answers: { ...recovered.answers, ...local?.answers },
      timing: { ...recovered.timing, ...local?.timing },
      currentIndex: local?.currentIndex ?? recovered.currentIndex,
      dirtyQuestionIds: local?.dirtyQuestionIds ?? [],
      flaggedQuestionIds: local?.flaggedQuestionIds ?? [],
    });
    persistCurrent(get);
  },
  setAnswer: (questionId, answer) => {
    set((state) => ({
      answers: { ...state.answers, [questionId]: answer },
      dirtyQuestionIds: state.dirtyQuestionIds.includes(questionId)
        ? state.dirtyQuestionIds
        : [...state.dirtyQuestionIds, questionId],
    }));
    persistCurrent(get);
  },
  setCurrentIndex: (currentIndex) => {
    set({ currentIndex });
    persistCurrent(get);
  },
  addTime: (questionId, milliseconds) => {
    set((state) => ({
      timing: {
        ...state.timing,
        [questionId]: (state.timing[questionId] ?? 0) + milliseconds,
      },
      dirtyQuestionIds:
        !state.answers[questionId] ||
        state.dirtyQuestionIds.includes(questionId)
        ? state.dirtyQuestionIds
        : [...state.dirtyQuestionIds, questionId],
    }));
    persistCurrent(get);
  },
  markSynced: (questionIds) => {
    set((state) => ({
      dirtyQuestionIds: state.dirtyQuestionIds.filter(
        (questionId) => !questionIds.includes(questionId),
      ),
    }));
    persistCurrent(get);
  },
  toggleFlag: (questionId) => {
    set((state) => ({
      flaggedQuestionIds: state.flaggedQuestionIds.includes(questionId)
        ? state.flaggedQuestionIds.filter((id) => id !== questionId)
        : [...state.flaggedQuestionIds, questionId],
    }));
    persistCurrent(get);
    const current = get();
    const attemptFlags = readAttemptFlaggedQuestionIds(current.attemptId);
    persistAttemptFlags(
      current.attemptId,
      current.flaggedQuestionIds.includes(questionId)
        ? [...new Set([...attemptFlags, questionId])]
        : attemptFlags.filter((id) => id !== questionId),
    );
  },
  setConnected: (connected) => set({ connected }),
  clear: () => {
    const sessionId = get().sessionId;
    if (sessionId) localStorage.removeItem(storageKey(sessionId));
    set(emptyState);
  },
}));
