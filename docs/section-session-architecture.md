# Section-Scoped Exam Session Architecture

> **Status:** APPROVED
> **Approved by:** Project owner
> **Date:** 2026-07-27; scope extension approved 2026-09-03
> **Scope:** Sprint 3.1 onward

## Decision

An exam attempt contains either every section assembled in the exam or one
selected section. Full TSA attempts remain split into three sequential,
independently timed section sessions:

1. `MATH` — 60 minutes
2. `READING` — 30 minutes
3. `SCIENCE` — 60 minutes

The UX follows the supplied TSA reference: confirmation before each section,
server-authoritative section timer, a transition summary after submission, and
an explicit continuation action for the next section.

## Domain Model

### `ExamAttempt`

`ExamAttempt` is the aggregate root for one user's complete run through an exam.
It owns the overall lifecycle, selected sections, current section, and final
aggregate result.

Required fields:

- `userId`
- `examId`
- `selectedSections` — canonical ordered scope for this attempt
- `status`
- `currentSection`
- `startedAt`
- `completedAt`
- `activeKey` — nullable unique key preventing concurrent active attempts for
  the same `(userId, examId)`

### `ExamSession`

`ExamSession` represents exactly one timed section inside an `ExamAttempt`.

Required additions:

- `attemptId`
- `sectionType`
- `durationMins`

Invariants:

- `@@unique([attemptId, sectionType])`
- A section may start only after all preceding selected sections are submitted.
- A submitted section cannot be reopened or edited.
- `endTime` is computed once by the server when the section starts.
- Reloading or reconnecting never resets `startTime` or `endTime`.

### `ExamResult`

The aggregate `ExamResult` belongs to `ExamAttempt`, not to one section
session. `sectionScores` remains the source of per-section breakdown.

## Lifecycle

```text
Create/resume attempt
  -> Confirm MATH
  -> Start MATH session (60m)
  -> Submit/timeout
  -> Transition summary
  -> Confirm READING
  -> Start READING session (30m)
  -> Submit/timeout
  -> Transition summary
  -> Confirm SCIENCE
  -> Start SCIENCE session (60m)
  -> Submit/timeout
  -> Attempt SUBMITTED
  -> Aggregate grading
```

Sections with zero questions are skipped when resolving the next section.
For a single-section attempt, submitting that section immediately submits the
attempt for grading. Only selected sections contribute to the result. A partial
retake of a multi-section exam is excluded from that exam's full leaderboard.

## API Shape

- `POST /api/v1/sessions` — create or resume an `ExamAttempt`; optional
  `sectionTypes` selects one section or every available section
- `GET /api/v1/sessions/attempts/:attemptId` — attempt and section progress
- `POST /api/v1/sessions/attempts/:attemptId/start` — start/resume the current section
- `GET /api/v1/sessions/:sessionId` — safe section payload and timing metadata
- `POST /api/v1/sessions/:sessionId/sync` — batch answers to Redis
- `GET /api/v1/sessions/:sessionId/state` — Redis state with PostgreSQL fallback
- `PATCH /api/v1/sessions/:sessionId/submit` — final section flush and transition

Correct answers, grading keys, and solutions must never be returned by active
session endpoints.

## Timing Configuration

The fixed durations are `MATH=60`, `READING=30`, and `SCIENCE=60`.
`Exam.durationMins` remains the displayed total and equals the sum of enabled
section durations for newly created exams.

## Redis and Persistence

Redis keys remain scoped by section session ID:

- `session:{sessionId}:answers`
- `session:{sessionId}:timing`
- `session:{sessionId}:meta`
- `idempotency:{sessionId}:sync:{key}`

Answers are buffered in Redis, flushed through BullMQ after 30 seconds, and
flushed synchronously on section submission. PostgreSQL remains the durable
fallback for recovery.

## UI Mapping

The supplied reference defines these required states:

- Section confirmation screen
- Section validation/loading screen
- Active exam shell with timer, navigator, progress, and connection status
- Fullscreen-exit warning
- Section submission confirmation
- Section completion and next-section transition
- MATH single-column layout
- READING/SCIENCE two-column independent-scroll layout

Question renderers and proctoring behavior remain Sprint 3.2 deliverables, but
the Sprint 3.1 shell and store must expose the state required by those screens.
