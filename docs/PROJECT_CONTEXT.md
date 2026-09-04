# 📍 PROJECT CONTEXT — CBT Platform (Live State Document)

> **For agents:** Read this file FIRST at the start of every new conversation.  
> **Mandate:** Update the "Current Status" and "Sprint Progress" sections at the END of every task that makes meaningful progress.  
> **Do NOT** rewrite other sections unless an architectural decision has changed and was explicitly approved by the user.

---

## 🗂️ Project Identity

| Field | Value |
|-------|-------|
| **Project name** | CBT Platform — TSA HUST Simulation |
| **Description** | Web-based Computer-Based Testing system simulating the TSA exam (Đánh giá Tư duy) of Hanoi University of Science & Technology (Bách Khoa Hà Nội) |
| **Workspace root** | `/Users/kietnt/Documents/dev/cbt-platform` |
| **User role** | Senior Tech Lead / Technical Project Manager |
| **Agent Persona** | **Senior Tech Lead** & **Technical Project Manager** with extensive experience building highly concurrent, distributed systems and decoupled/microservices architectures. |
| **Target users** | Vietnamese high-school students preparing for TSA; community contributors; admin staff |
| **Tech stack** | NestJS · Prisma 6 · PostgreSQL 16 · Redis 7 · BullMQ · React 19 · Vite · Tailwind CSS v4 · TanStack Query · Zustand · react-katex · @dnd-kit |

---

## 📊 Current Status

> **Last updated:** 2026-09-04 (exam overview, Drag drop guidance, and compact access-code table completed)

### Active Sprint
**Exam Overview and Admin Usability**
Status: ✅ FEATURE COMPLETE / DEPLOYMENT PENDING — retake actions are clearer, Drag drop authoring is self-explanatory, recent formulas render correctly, and access-code actions fit without horizontal scrolling

### Sprint Progress Overview

| Sprint | Name | Status | Completion |
|--------|------|--------|-----------|
| 1.1 | Project Bootstrap & Infrastructure Core | ⚠️ AUDITED | 95% |
| 1.2 | Authentication & Question Content Model | ⚠️ PARTIAL | 85% |
| 2.1 | Admin Question Bank Management | ⚠️ AUDITED | 95% |
| 2.2 | Exam Assembly & Access Code System | ⚠️ PARTIAL | 95% |
| 3.1 | Exam Session Engine & Write Path | ⚠️ PARTIAL | 95% |
| 3.2 | Question Renderers & Proctoring | ⚠️ PARTIAL | 95% |
| 4.1 | Result Engine & Personal Analytics | ⚠️ PARTIAL | 95% |
| 4.2 | IRT Integration & Advanced Features | ⏸ DEFERRED | 0% |
| 5.1 | Performance & Security Hardening | 🔄 IN PROGRESS | 20% |
| 5.2 | Final Polish, UAT & Launch | ⏸ DEFERRED | — |

---

## ✅ Sprint 1.1 — What Was Completed

### Infrastructure
- [x] NestJS monorepo setup — modules: `auth`, `users`, `questions`, `exams`, `sessions`, `analytics`, `admin`, `common`, `health`
- [x] Docker Compose: PostgreSQL 16 (`cbt_postgres`), Redis 7 (`cbt_redis`), pgAdmin, RedisInsight
- [x] `.env` / `.env.example` with all required environment variables
- [x] GitHub Actions CI pipeline: lint → typecheck → build

### Database (Prisma — 18 tables, 2 migrations applied)
- [x] Migrations: `20260703095258_init` + `20260704192104_schema_revamp_sprint1_1`
- [x] All 18 tables created and verified:
  `users`, `refresh_tokens`, `tags`, `question_tags`, `questions`,
  `passage_bundles`, `passage_bundle_questions`,
  `exams`, `exam_math_questions`, `exam_passage_bundles`,
  `access_codes`, `exam_accesses`,
  `exam_sessions`, `session_answers`, `exam_results`,
  `proctoring_events`, `contribution_submissions`, `_prisma_migrations`
- [x] Seed file (`apps/api/prisma/seed.ts`) with admin user, sample student, tag taxonomy, default exam, sample question

### Frontend Foundation
- [x] Vite + React 19 + TypeScript strict mode
- [x] **Tailwind CSS v4** — CSS-first config in `apps/web/src/index.css` via `@theme {}`. **No `tailwind.config.js`**.
- [x] Design system tokens: Inter font, primary/accent/neutral/success/danger/warning palettes, question navigator colors
- [x] Layout shells: `RootLayout`, `AuthLayout`, `ExamLayout`
- [x] Component CSS classes: `.card`, `.btn`, `.btn-primary/.secondary/.danger/.ghost`, `.input`, `.badge`, `.q-nav-item`
- [x] `vite.config.ts`: `@tailwindcss/vite` plugin, `@` alias, dev proxy `/api → localhost:3000`, code splitting

### Documentation
- [x] `docs/QuestionContentSpec.md` v2.1 — canonical content schema
- [x] `docs/execution_plan.md` — updated to reflect Sprint 1.1 architecture
- [x] `.agents/AGENTS.md` — comprehensive project rules for agents
- [x] `docs/Sprint_1.1_Onboarding_Guide.md` — onboarding guide for new developers

---

## ✅ Sprint 1.2 — What Was Completed

**Goal:** By end of Sprint 1.2, a user should be able to register, login, and an admin should be able to create a question.

### Backend — Sprint 1.2
1. **Auth module** (`apps/api/src/auth/`)
   - [x] `POST /api/v1/auth/register`
   - [x] `POST /api/v1/auth/login` → accessToken (15m) + refreshToken HttpOnly cookie (7d)
   - [x] `POST /api/v1/auth/refresh` → Rotation + Reuse Detection
   - [x] `POST /api/v1/auth/logout`
   - [x] `JwtAuthGuard`, `RolesGuard`

2. **Question CRUD API** (Admin-only) — `apps/api/src/questions/`
   - [x] `POST/GET/PATCH/DELETE /api/v1/admin/questions`
   - [x] `PATCH /api/v1/admin/questions/:id/status`
   - [x] `QuestionContentSpec.md` validation for 5 question types
   - [x] IRT defaults `{ a: 1.0, b: 0.0, c: 0.25 }`

3. **PassageBundle CRUD API** — `apps/api/src/questions/`
   - [x] `POST/GET/PATCH /api/v1/admin/passage-bundles`
   - [x] Validate: READING = exactly 10q, SCIENCE = exactly 5q

4. **Contribution Submission API** — `apps/api/src/contributions/`
   - [x] `POST /api/v1/contributions` (multipart PDF/DOCX upload)
   - [x] `GET /api/v1/contributions/mine`
   - [x] `GET /api/v1/admin/contributions`
   - [x] `PATCH /api/v1/admin/contributions/:id/status`

5. **File Upload** — `POST /api/v1/admin/upload`
   - [x] Supabase Storage adapter for `images` bucket
   - [x] Supabase Storage adapter for private `contributions` bucket
   - [x] Signed URL endpoint for contribution file access

### Frontend — Sprint 1.2
1. [x] Login page (`/login`) — React Hook Form + Zod
2. [x] Register page (`/register`)
3. [x] Zustand `authStore` — user info + access token
4. [x] TanStack Query auth hooks
5. [x] Protected route wrapper
6. [x] Axios instance with Bearer token + 401 refresh interceptor

---

## ✅ Sprint 2.1 — What Was Completed

**Goal:** Admin can operate the question bank: taxonomy, filtering, review workflow, bulk import, and core content entry UI.

### Backend — Sprint 2.1
1. **Tag / Taxonomy API**
   - [x] `GET /api/v1/admin/tags` returns hierarchical Subject → Chapter → Topic → SubTopic tree
   - [x] `POST /api/v1/admin/tags` creates a tag with `parentId`, computed `depth`, `slug`, `orderIndex`
   - [x] `GET /api/v1/admin/questions` supports multi-tag filter via `tagId[]`
   - [x] `PassageBundle` supports direct taxonomy tags via `passage_bundle_tags`
   - [x] Tags are section-aware via `sectionType` and support admin list/create/edit flows under `/admin/tags`

2. **Question Review Workflow**
   - [x] `PATCH /api/v1/admin/questions/:id/status` supports status transitions with `reviewNote`

3. **Bulk Import API**
   - [x] `POST /api/v1/admin/questions/bulk` accepts up to 100 JSON questions, validates content/IRT, and inserts transactionally
   - [x] `PATCH /api/v1/admin/questions/bulk/status` updates selected questions transactionally

4. **Filtering & Pagination**
   - [x] Question list supports `page`, `limit`, `sortBy`, `sortOrder`, `tagId[]`, `level`, `type`, `status`
   - [x] Response shape remains `{ data, meta }`

5. **Hardening**
   - [x] Tag slug conflict returns domain-level `409 Conflict`
   - [x] Question status transitions are validated before update
   - [x] Refresh-token multi-tab race no longer revokes all active sessions on concurrent bootstrap
   - [x] Logout calls server revocation, clears refresh cookie, suppresses auto-bootstrap, and syncs logout across browser tabs
   - [x] Login redirect is role-aware: ADMIN → `/admin`, USER → `/exams`

### Frontend — Sprint 2.1
1. [x] Admin dashboard layout with sidebar entries: Unified Question Content, Contributions, Exams, Users, Access Codes, Analytics
2. [x] Question List Page with filters, pagination, bulk select, Publish/Archive actions
3. [x] Question Create Form with dynamic payload editors for all 5 question types
4. [x] RichText/LaTeX preview using `react-katex`
5. [x] IRT params input with browser tooltips
6. [x] Tag selector using taxonomy tree
7. [x] Contribution Review UI with status filter, file preview/signed URL, `adminNote`, Reviewing/Approve/Reject actions
8. [x] PassageBundle Create Form with RichText passage editor and exact 10/5 question linking workflow
9. [x] Bulk JSON import UI for admin paste/upload flow
10. [x] Admin theme uses TSA red primary palette consistent with login/register pages
11. [x] New browser tabs bootstrap auth session from HttpOnly refresh cookie before redirecting
12. [x] `/admin/questions` is now a unified Section Content Bank: MATH standalone questions; READING/SCIENCE passage bundle + 10/5 related questions in one flow
13. [x] Question management routes split list and editing flows: `/admin/questions` lists by section, while `/admin/questions/create` and edit routes reuse the shared content editor
14. [x] Create Question section query param only initializes the active section; tab switches update create state, URL, and submitted section payload
15. [x] Tag Management module added: `/admin/tags` list with MATH/READING/SCIENCE tabs plus shared create/edit tag form pages
16. [x] READING/SCIENCE bundle list omits empty status filter so "All status" shows seeded bundles correctly
17. [x] Manual question editor uploads PNG/JPEG/WebP/SVG assets directly to Supabase using an explicit multipart request and inserts image nodes into stems, solutions, passages/stimuli, choice answers, matrix statements, and drag/drop content; edit/save round trips preserve existing images and upload errors expose the API validation message
18. [x] Tag and question/bundle editors provide Back navigation and guarded Delete actions; used taxonomy/content returns a domain-level conflict instead of unsafe deletion
19. [x] Reading/Science bundle passage writes normalize supported legacy paragraph/text/line-break nodes before canonical validation, resolving compatible `contentJson[0].type is invalid` payloads
20. [x] Added FILL_TEXT authoring, rendering, validation, grading, answer extraction, blueprint selection, and bulk-import support with Vietnamese-aware normalized matching
21. [x] Question-bank cards and exam previews reuse the production RichText renderer for LaTeX/images; question inspection shows only the rendered stem and structured answers
22. [x] Drag drop authoring now explains Items and Slots inline with examples, clearer Vietnamese labels/placeholders, and answer mappings that include Item content; recent standalone MATH questions render RichText/KaTeX instead of raw markup

---

## ✅ Sprint 2.2 — What Was Completed

**Goal:** Admin can assemble and publish a complete exam; users can unlock locked exams using access codes.

### Backend — Sprint 2.2
1. [x] Exam blueprint generation API: create/update blueprint, availability check, seeded draft generation/regeneration, preview, publish validation
   - Added focused exam settings update endpoint for admin metadata/access policy changes (`title`, `description`, `accessType`) without altering generated content.
   - Phase 2 blueprint split completed: `ExamBlueprint` is now a standalone entity with CRUD/list/availability APIs under `/api/v1/admin/exam-blueprints`; `Exam.blueprintId` links generated exams to the reusable template while `Exam.blueprintJson` remains the immutable snapshot.
   - Preview API now returns richer generated item payloads including question/bundle content JSON, tags, points, difficulty, and ordering for admin inspection.
2. [x] Seed mock TSA generation bank: 50 standalone MATH questions, 3 READING bundles x10 questions, 10 SCIENCE bundles x5 questions
   - Seed now creates the default `TSA Standard Matrix` blueprint and links the default free exam to that template snapshot.
3. [x] Manual Exam Management API: reorder/replace math questions and passage bundles on generated draft exams
   - Added builder APIs under `/api/v1/admin/exams/:id/builder` for full assembly inspection, replacement candidates, section reorder, and slot replacement.
   - Published exams are locked from assembly edits; admins must unpublish before changing question/bundle composition to preserve audit consistency.
   - Replacement candidates only include published standalone MATH questions and valid published READING/SCIENCE bundles with exact bundle cardinality.
   - Manual assembly now supports adding/removing standalone MATH questions and atomic READING/SCIENCE bundles, with automatic ordering and total-point recalculation.
4. [x] Access Code API: create/list/deactivate codes, atomic unlock flow
   - Added `AccessCodesModule` with admin list/create/deactivate endpoints under `/api/v1/admin/access-codes`.
   - Added `POST /api/v1/exams/unlock` with Serializable transaction semantics, quota increment, expiry/active checks, and idempotent already-unlocked handling.
   - Access codes are generated as 8-character uppercase alphanumeric codes and can only be created for published `LOCKED` exams.
5. [x] User Exam List API: list unlocked/public exams with question counts
   - Added authenticated `GET /api/v1/exams` and `GET /api/v1/exams/:id`.
   - User visibility is restricted to published PUBLIC exams or published LOCKED exams backed by `ExamAccess`.
   - Responses include per-section and total question counts, access source, and latest session metadata without exposing question content, solutions, or correct answers.
   - Added focused unit tests for access filtering, section count mapping, response redaction, and inaccessible exam handling.

### Frontend — Sprint 2.2
1. [x] Admin Exam Management UI: list exams, create metadata, edit blueprint JSON, check availability, generate/regenerate draft, preview section breakdown, publish/unpublish
   - Phase 1 UX split completed: `/admin/exams` is now a focused exam list with preview/publish actions; `/admin/exams/create` owns metadata, blueprint selection/editing, availability check, draft generation, preview, and publish.
   - Admin preview now opens as a modal with generated MATH questions and READING/SCIENCE bundle/question snippets from the preview API.
   - Exam list now includes a Settings modal for editing title, description, access type (`LOCKED`/`PUBLIC`), and publish state; standalone publish/unpublish table actions were removed.
   - Added `/admin/exam-blueprints` for list/create/edit blueprint templates; `/admin/exams/create` now selects a saved blueprint instead of relying on hard-coded frontend templates.
   - Phase 3 UX completed: blueprint templates now use a form builder for section targets, tag quotas, child tag min/max, difficulty rules, and MATH question type rules, with readonly JSON preview for audit.
   - Exam preview modal now includes an item detail inspector for MATH questions and READING/SCIENCE bundles/questions with content, payload, solution, tags, points, and order metadata.
2. [x] Manual Exam Builder UI with drag ordering and item replacement
   - Added `/admin/exams/:examId/edit` as a dedicated exam edit workspace with MATH/READING/SCIENCE tabs, drag ordering, replacement bank, validation summary, and preview access.
   - `/admin/exams` now links generated exams to Edit, and `/admin/exams/create` shows an Open editor CTA after successful generation.
   - Admin dropdowns now use a shared custom `SelectField` component instead of native browser `<select>` popups for a consistent polished UI across question, contribution, tag, exam, blueprint, and editor screens.
   - Admin question lists now page at 20 items per page, and question/tag editors render taxonomy as a parent-child tree instead of a flat tag list.
   - Blueprint builder now uses tag min/max rules with nested sub-tag and tag-scoped difficulty configuration; root tag quota is removed from UI and ignored by blueprint normalization.
   - Exam management now routes generated exams to `/admin/exams/:examId/edit`, combining metadata edit, assembly reorder/replacement, preview, and delete with confirmation for published-impacting edits.
   - Exam edit workspace now includes publish/unpublish controls and a visible Draft/Published badge so admins can manage release state without returning to the exam list.
   - Exam edit header now includes a primary Save action for title/description metadata changes, while reorder/replace actions continue to persist immediately.
   - Exam creation now explicitly offers Manual or Blueprint mode. Manual mode creates a scoped draft and opens the content bank, where admins can add, remove, replace, and reorder items before preview/publish.
   - Exam management now allows every exam shell to open the editor, including manual/snapshot-only and not-yet-generated drafts; edit availability is no longer incorrectly tied to `generatedAt`.
3. [x] Access Code Management UI
   - `/admin/access-codes` now provides metrics, access code generation for published locked exams, usage/expiry/status table, copy action, and deactivate action.
   - The access-code table now uses a fixed compact layout, combines status with expiry, truncates long exam metadata, and keeps Copy/deactivate actions visible without horizontal scrolling.
4. [x] User Exam Library unlock flow
   - `/exams` now provides a student-facing exam library with real exam metadata, progress status, loading/error/empty states, and a polished TSA-themed responsive layout.
   - Added normalized 8-character access code entry wired to `POST /api/v1/exams/unlock`, including success/error feedback and automatic library refresh.
   - `/exams/:id` now shows safe exam metadata, section structure, instructions, access state, and a Sprint 3.1-ready start/resume area.
   - Exam list was refined from the approved visual reference into a two-column information-card layout with a compact exam header, real metadata rows, access status, and green action controls; the unlock banner remains unchanged.
   - Exam overview now places start/resume/full-retake directly in a compact banner, removes the redundant latest-result action, and keeps per-section practice choices in a dedicated card for multi-section exams.

### Quality & Tooling — Sprint 2.2 Closeout
- [x] API unit tests pass (3/3)
- [x] API and Web TypeScript typecheck pass
- [x] API and Web production builds pass
- [x] Added ESLint 9 flat configuration; both workspace lint scripts pass
- [x] Confirmed no spurious `vite.config.js` / `vite.config.d.ts` output

---

## ✅ Sprint 3.1 — What Was Completed

**Goal:** A student can start or resume an authorized exam, answer reliably through transient network failures, recover state, and submit exactly once.

### Backend — Sprint 3.1
1. [x] Migrated `ExamAttempt` aggregate plus section-scoped `ExamSession`; aggregate `ExamResult` ownership moved to the attempt
2. [x] Added create/resume attempt, sequential section start, safe section payload, server-authoritative section `endTime`, timeout jobs, and idempotent submit/transition
3. [x] Added Redis answer sync with batched writes, 24-hour TTL, section membership validation, and `X-Idempotency-Key`
4. [x] Added BullMQ delayed flush/final synchronous flush to PostgreSQL plus final `grade-attempt` queue hand-off
5. [x] Added session recovery with Redis primary and PostgreSQL fallback

### Frontend — Sprint 3.1
1. [x] Added section confirmation/loading screens based on the approved TSA reference
2. [x] Added Zustand exam store persisted under `exam_session_{sessionId}` and linked to its parent attempt
3. [x] Added debounced answer sync, offline queue, reconnect handling, and final pre-submit sync
4. [x] Added server-authoritative section countdown timer with automatic timeout submission
5. [x] Added submission confirmation, completion summary, and explicit next-section transition
6. [x] Added MATH single-column and READING/SCIENCE independent-scroll two-column shells, navigator, progress, connection state, and fullscreen-exit warning
7. [x] Per-question elapsed time now updates live every second, preserves recovered timing, commits on navigation, and flushes the active question before final submission

### Quality — Sprint 3.1
- [x] Prisma migration `20260727041422_add_section_scoped_exam_attempts` applied and database constraints verified
- [x] API unit tests pass (4/4)
- [x] API and Web lint, typecheck, and production builds pass
- [x] End-to-end localhost smoke test passed: create attempt → MATH sync/recovery/submit → READING → SCIENCE → idempotent final submit
- [x] Active session payload smoke test found zero leaked grading keys or solutions

---

## ✅ Sprint 3.2 — What Was Completed

### Backend — Sprint 3.2
1. [x] Added BullMQ `grade-attempt` worker with exponential retry and dead-letter queue
2. [x] Implemented all five grading rules; multi-slot types are all-or-nothing and FILL_NUMBER uses exact parsed numeric equality
3. [x] Persisted aggregate `ExamResult`, `sectionScores`, tag breakdown, duration, and graded `SessionAnswer` details
4. [x] Updated Redis leaderboard after successful grading
5. [x] Added batched proctoring event ingestion and admin session event timeline API
6. [x] Added authenticated result and post-grading answer-review APIs; correct answers and solutions remain unavailable before grading

### Frontend — Sprint 3.2
1. [x] Completed all five question renderers with RichText/KaTeX support and native `@dnd-kit` drag-and-drop with touch sensor
2. [x] Added per-question review flags and navigator flagged state
3. [x] Added `useProctoringMonitor` for tab switch, blur, copy, and fullscreen-exit events with 10-second batching/retry
4. [x] Added aggregate result page with section score cards, correctness summary, duration, and tag progress
5. [x] Added answer-review page with correct/wrong/skipped filters, passage layout, correct answers, solutions, and timing
   - Replaced the card-list review with the full exam workspace: readonly answers, no countdown, section navigation, and correctness-based navigator states.
   - Review navigator now uses circular single-choice-style buttons; unanswered questions are classified and displayed with the same state as incorrect answers.
   - Review navigator sizing and eight-column layout now match the live exam navigator, with the requested solid correctness colors and white question numbers.
6. [x] Final section completion now routes to `/results/:attemptId`; exam library/detail link to the latest graded result

### Quality — Sprint 3.2
- [x] Grading unit tests cover all five question types and pass (9/9 total API tests)
- [x] API and Web lint, typecheck, and production builds pass
- [x] Smoke grading persisted `ExamResult` with 100 assembled questions and the expected 1 wrong / 99 skipped breakdown
- [x] Review smoke returned 40 MATH questions, 2 READING bundles, and 8 SCIENCE bundles with post-grading answers
- [x] Proctoring smoke recorded two student events and returned the ordered timeline to an admin
- [x] Redis leaderboard and PostgreSQL aggregate result were verified directly

---

## ✅ Sprint 4.1 — What Was Completed

### Backend — Sprint 4.1
1. [x] Added paginated personal exam history with aggregate score, correctness, duration, and section breakdown
   - Added a global `/analytics/me/history` feed and student `/history` page linked above Account in the sidebar, with direct result and review actions.
2. [x] Added weakness/strength aggregation over the latest 50 result tag breakdowns
3. [x] Added per-section actual-versus-expected question time analysis
4. [x] Added authenticated top-100 Redis leaderboard with current-user rank and best-score-only updates
5. [x] Changed answer review to section-scoped pagination while preserving READING/SCIENCE PassageBundle atomicity

### Frontend — Sprint 4.1
1. [x] Added personal analytics dashboard with progress, strengths, weaknesses, timing, history, and leaderboard views
2. [x] Added section radar and tag bar charts to aggregate results
3. [x] Added section tabs and lazy pagination to answer review
4. [x] Preserved per-question review flags across sequential sections for the post-exam flagged filter
5. [x] Added a direct `Thi lại` action beside the latest result on every completed exam card; retakes remain unlimited and reuse the idempotent create-or-resume flow
6. [x] Retired the standalone user/admin analytics page and navigation; progress, attempt history, and leaderboard now live in the result page for the selected exam, while strength/weakness and pacing insights are intentionally omitted from UI
7. [x] Redesigned the result summary as a compact score-and-candidate card with exact first-section start time, attempt completion time, direct review/library actions, and expandable full/per-section practice choices; corrected review navigation to green for correct and red for wrong/skipped with a non-clipping active marker

### Quality — Sprint 4.1
- [x] API unit tests pass (11/11), including analytics aggregation and leaderboard hydration
- [x] API and Web lint, typecheck, and production builds pass
- [x] Local smoke verified history/weakness/time/leaderboard endpoints
- [x] Review smoke verified MATH 10-question pages, READING 10-question atomic bundles, and SCIENCE 5-question atomic bundles
- [x] Corrected the API production start entrypoint from `dist/main` to `dist/src/main`
- [x] No database schema change or migration was required

---

## ✅ Phase 4.1 Completion Fixes

### Admin User Management
1. [x] Added paginated/searchable/filterable admin users API and management table
2. [x] Added user activity counts, role management, and account lock/unlock
3. [x] Prevented an admin from deactivating or changing the role of their own account
4. [x] Revoked active refresh tokens immediately when an account is locked

### User Account
1. [x] Added personal profile API and account overview with attempt/access/contribution counts
2. [x] Added display-name update and synchronized the authenticated user store
3. [x] Added current-password verification, secure password replacement, refresh-token revocation, and forced re-login

### Quality
- [x] API test suite passes (14/14)
- [x] API and Web lint, typecheck, and production builds pass
- [x] Local smoke verified student profile read/update, admin user filtering, and self-deactivation guard
- [x] Refined account form actions and replaced admin user pagination labels with compact accessible chevrons
- [x] No database schema change or migration was required

---

## ✅ Single-Section Exam and Scoped Retake Extension (2026-09-03)

### Backend and Data
1. [x] Added ordered `ExamAttempt.selectedSections` scope with migration/backfill for all historical attempts
2. [x] Added optional `sectionTypes` to attempt creation; only one section or every available section is accepted
3. [x] Limited transitions, grading, section scores, and answer review to the selected attempt scope
4. [x] Kept fixed section timers at MATH 60 minutes, READING 30 minutes, and SCIENCE 60 minutes
5. [x] Excluded partial retakes of multi-section exams from the full-exam leaderboard
6. [x] Added admin exam creation scope; generated blueprint snapshots and displayed total duration now contain only the selected section(s)

### Frontend
1. [x] Added full-exam or single-section selection to admin exam creation
2. [x] Added full or per-section retake choices to exam detail and result pages
3. [x] Made exam detail/library section counts and cards work for one-section exams
4. [x] Limited answer-review tabs to sections actually completed in the selected attempt
5. [x] Labeled attempt-history rows by full-exam or individual-section scope

### Quality
- [x] Migration `20260903090000_add_attempt_selected_sections` applied successfully with historical backfill
- [x] 31/31 API and 6/6 Web unit tests pass
- [x] API and Web lint, typecheck, and production builds pass

---

## 🔄 Production Deployment Preparation (2026-09-03)

### Deployment Stack
1. [x] Added multi-stage production Docker images for the NestJS API and React/Nginx Web app
2. [x] Added production Compose orchestration for API, Web, PostgreSQL, Redis, and one-shot Prisma migrations
3. [x] Kept API/Web host bindings on loopback and PostgreSQL/Redis private to Docker networks
4. [x] Added host Nginx reverse-proxy configuration for `demoserver.io.vn` and an Ubuntu deployment/backup/update runbook
5. [x] Added a safe production environment template; real credentials remain excluded from Git
6. [ ] Point `demoserver.io.vn` to the Ubuntu server, perform the remote rollout, and issue the Let's Encrypt certificate

### Security and Quality
1. [x] Enabled the configured NestJS throttler globally and trusted exactly one production reverse proxy
2. [x] Upgraded bcrypt 5 → 6, removing the vulnerable `node-pre-gyp`/`tar` installation chain
3. [x] Removed unused vulnerable Nodemailer runtime/type dependencies
4. [x] Web production dependency audit reports 0 vulnerabilities; API critical findings reduced to 0
5. [ ] Upgrade and regression-test the NestJS major dependency family to resolve the remaining transitive audit findings (7 high, 9 moderate, 1 low in the current production dependency audit)
6. [x] API/Web lint, typecheck, production builds, 32 API tests, and 8 Web tests pass
7. [x] Production API/Web images build; API runtime/bcrypt and Web Nginx configuration smoke tests pass
8. [x] Made the loopback API host port configurable and defaulted it to `3100` to avoid the deployment host's existing port-3000 service
9. [x] Made the loopback Web host port configurable and defaulted it to `8180` to avoid the deployment host's existing port-8080 service

### Local Data Operation
1. [x] Created and password-verified the two requested active customer accounts in the local PostgreSQL database with default public-exam access
2. [ ] Recreate those accounts through the HTTPS registration flow after a fresh production deployment, or explicitly restore the local database if its full dataset is intended for production

---

## ⚠️ Phase 1–4.1 Audit Findings (2026-07-27)

### High Priority
1. [ ] Implement refresh-token family/reuse detection: live verification returned `401` for the reused token but its successor still refreshed successfully (`201`), so reuse does not revoke all user sessions as documented.
2. [ ] Preserve published-attempt content: question and passage content can still be edited after exam publication, while grading and answer review read live question-bank JSON. Add an immutable exam/attempt snapshot or prohibit mutations that would alter published/historical attempts.

### Medium Priority
3. [ ] Make offline timeout recovery deterministic: the client marks auto-submit as attempted before an offline sync failure and does not retry the transition after reconnect; the server timeout job submits the section but the current UI can remain stuck.
4. [x] Apply answer-review filters across the whole selected section, not only the currently loaded page/bundle.
5. [x] Standardize `orderInBundle` as zero-based end-to-end; admin create/edit and persisted legacy rows now use zero-based ordering.
6. [ ] Complete `QuestionContentSpec` validation for optional enums/fields and exact blank mapping; honor `displayOrder: "shuffle"` in the renderer.
7. [x] Enforce contribution transitions `PENDING → REVIEWING → APPROVED | REJECTED` instead of accepting arbitrary non-PENDING target states.
8. [x] Remove the unused registration phone field from the API and frontend contract.

### Verification and Tooling
9. [ ] Add automated coverage for auth rotation/reuse, question/bundle CRUD and validation, access-code concurrency, exam builder/publish, result authorization/pagination, and contribution workflow.
10. [ ] Add frontend component/e2e tests for the complete register → unlock → section sessions → submit → result/review flow.
11. [x] Add the API production build and frontend unit tests to CI.

### Audit Evidence
- [x] PostgreSQL and Redis healthy; Prisma schema valid; FILL_TEXT migration applied with no drift
- [ ] API and Web dev servers are not currently running on localhost; infrastructure containers remain healthy
- [x] 35/35 API unit tests and 8/8 Web unit tests pass; both lint jobs, both typechecks, and both production builds pass
- [x] Live seed smoke passed profile, exam library, admin users/questions/exams/access codes
- [x] Live graded-attempt smoke passed aggregate result, history, leaderboard, and MATH/READING/SCIENCE review endpoints

---

## 🎯 Next Up: Production Rollout and Remediation

1. [x] Complete exam-style readonly review, global student attempt history, and manual/blueprint exam creation flows
2. [x] Add direct image upload and lossless image-node editing to manual question authoring
3. [x] Fix circular review navigation, unanswered-as-incorrect display, and live per-question elapsed timing
4. [x] Allow manual, snapshot-only, generated, and empty exam shells to open the admin editor
5. [x] Add guarded tag/question/bundle deletion, Reading bundle legacy-node normalization, and the FILL_TEXT question type
6. [x] Render admin question/exam rich content consistently, localize difficulty levels, simplify question inspection, and compact the exam list table
7. [x] Redesign the result banner with exact participation details and actions, and correct answer-review navigator colors/selection styling
8. [x] Improve exam-overview retake actions, document Drag drop authoring in the UI, render recent-question formulas, and compact access-code management
9. [ ] Push the verified commits, deploy the updated containers to `demoserver.io.vn`, and verify the new flows over HTTPS
10. [ ] Complete the coordinated NestJS major upgrade and clear remaining production dependency audit findings
11. [ ] Complete atomic refresh-token rotation and protect published/historical exam assembly mutations
12. [ ] Complete section timeout retry for transient online failures
13. [ ] Close the remaining content-validation gaps and expand integration/regression coverage
14. [ ] Re-run end-to-end acceptance and only then restore Phase 1–4.1 to 100%
15. [ ] Keep Sprint 4.2 and 5.2 deferred until explicitly resumed

---

## 🏛️ Immutable Architecture Decisions

These decisions are FINAL and must not be reversed without explicit user approval:

### Schema Design
| Decision | Rule |
|----------|------|
| `PassageBundle` is atomic | READING/SCIENCE questions are ALWAYS selected as a whole bundle. Never add individual questions from a bundle to an exam. |
| READING bundle size | Exactly **10 questions** — validated at app layer |
| SCIENCE bundle size | Exactly **5 questions** — validated at app layer |
| Exam assembly | MATH → `ExamMathQuestion` table. READING/SCIENCE → `ExamPassageBundle` table. |
| `Question.authorId` | = person credited PUBLICLY (contributor's userId for community questions, not the admin's userId) |
| `ContributionSubmission` | Community uploads PDF/DOCX only. Admin manually enters questions and sets `authorId = contributor.userId` |
| `FILL_NUMBER` structure | Uses `blanks[]` array. **NO single `correctValue`**. **NO `tolerance`**. Exact match only. |
| `FILL_TEXT` structure | Uses `blanks[]` with string `correctValue`; Unicode/whitespace normalized, case-insensitive by default, Vietnamese diacritics preserved. |
| All-or-nothing grading | `MULTIPLE_CHOICE`, `TRUE_FALSE_MATRIX`, `DRAG_DROP`, `FILL_NUMBER`, `FILL_TEXT` — partial credit forbidden |
| Migration-only workflow | Never use `prisma db push`. Always `prisma migrate dev`. |

### Tech Choices
| Decision | Rule |
|----------|------|
| **Exam attempt/session lifecycle** | One `ExamAttempt` aggregates either every available section or one selected section. Full attempts remain sequential MATH → READING → SCIENCE; each selected section has its own confirmation, server-authoritative timer, submission, and transition screen. |
| **Fixed section durations** | MATH = 60 minutes, READING = 30 minutes, SCIENCE = 60 minutes. |
| **Aggregate result ownership** | `ExamResult` belongs to `ExamAttempt`; `sectionScores[]` stores the MATH/READING/SCIENCE breakdown. |
| Tailwind CSS | **v4 only**. CSS-first `@theme {}`. No `tailwind.config.js`. Plugin: `@tailwindcss/vite`. |
| Rich text format | **`RichTextNode[]` JSON** (NOT Markdown string). See `QuestionContentSpec.md`. |
| File storage | **Supabase Storage**. Public `images` bucket for question images; private `contributions` bucket with signed URLs for PDF/DOCX. |
| API versioning | URI versioning — all routes: `/api/v1/...` |
| Redis role | Answer buffer during sessions. Session state. Leaderboard sorted set. NOT for token blacklist. |
| Refresh token storage | Hashed in PostgreSQL `refresh_tokens` table. NOT Redis blacklist. |
| Answer sync pattern | Client buffers in Zustand → POST /sync to Redis → BullMQ worker flushes to PostgreSQL every 30s |
| `prisma db push` | **FORBIDDEN** on this project |
| **UI Mockup rule** | **Before coding UI**, ask the user for screenshots/mockups to replicate. If not provided, autonomously design using project CSS theme. |

### Question Types (6 total, defined in QuestionContentSpec.md v2.2)
```
SINGLE_CHOICE     → 1 correct option, radio
MULTIPLE_CHOICE   → N correct options, checkboxes, all-or-nothing
TRUE_FALSE_MATRIX → Đúng/Sai per statement, all-or-nothing
DRAG_DROP         → Items into slots, all-or-nothing
FILL_NUMBER       → Multiple blanks[], exact match, all-or-nothing
FILL_TEXT         → Multiple text blanks[], Vietnamese-aware normalized match, all-or-nothing
```

---

## 📁 Key Files Reference

| File | Purpose |
|------|---------|
| `docs/PROJECT_CONTEXT.md` | **THIS FILE** — Live project state (read first, update last) |
| `docs/execution_plan.md` | Full 5-month sprint plan with deliverables |
| `docs/QuestionContentSpec.md` | Canonical question content schema v2.2 |
| `docs/section-session-architecture.md` | Approved ExamAttempt + independently timed section-session architecture |
| `docs/DEPLOY_UBUNTU_NGINX.md` | Production deployment, HTTPS, update, and backup runbook for the Ubuntu host |
| `deploy/docker-compose.production.yml` | Production API/Web/PostgreSQL/Redis orchestration and migration gate |
| `.agents/AGENTS.md` | Agent rules — Prisma workflow, commit convention, checklists |
| `apps/api/prisma/schema.prisma` | Database schema — source of truth (18 tables) |
| `apps/web/src/index.css` | Tailwind v4 design tokens + component CSS |
| `apps/web/vite.config.ts` | Vite config — plugins, alias, proxy, code splitting |

---

## 🔧 Local Dev Environment

| Service | Container | Port | Status (as of last update) |
|---------|-----------|------|--------------------------|
| PostgreSQL 16 | `cbt_postgres` | 5432 | ✅ Working — FILL_TEXT enum migration applied locally |
| Redis 7 | `cbt_redis` | 6379 | ✅ Working |
| pgAdmin | `cbt_pgadmin` | 5050 | ✅ Working — server import uses password exec command |
| RedisInsight | `cbt_redisinsight` | 5540 | ✅ Working |
| NestJS API | — | 3000 | ✅ Working — health and Phase 1–4.1 read flows smoke-tested against PostgreSQL/Redis |
| Vite frontend | — | 5173 | ✅ Working — localhost responds and all Phase 4.1 pages build successfully |

```bash
# Start dev environment
npm run docker:up    # if containers not running
npm run dev          # starts api (3000) + web (5173) concurrently
```

> API config loads `.env.local` / `.env` from both the current workspace and the repo root,
> so `npm run dev -w apps/api` works on a fresh clone with root-level `.env`.
>
> Dev seed credentials are refreshed on every `npm run prisma:seed -w apps/api`:
> Admin `admin@cbt-platform.com / Admin@123456`; Student `student@example.com / Student@123`.

---

## 📝 Agent Update Instructions

When ending a task that makes progress, update the following sections:

1. **"Current Status" → "Active Sprint"** — update sprint name and status
2. **"Sprint Progress Overview" table** — update status emoji and completion %
3. **"Next Up" section** — check off completed items, add new ones if needed
4. **"Local Dev Environment" table** — update service statuses if changed
5. **Update the "Last updated" date** at the top of "Current Status"

**Do NOT update:**
- "Immutable Architecture Decisions" section (unless user explicitly approves a change)
- "Project Identity" section (unless user changes scope)
- "Key Files Reference" section (only update if new key files are added)
