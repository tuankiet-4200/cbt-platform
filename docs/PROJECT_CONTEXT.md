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

> **Last updated:** 2026-07-07 (TSA mock generation seed bank)

### Active Sprint
**Sprint 2.2 (Tuần 7–8) — Exam Assembly & Access Code System**  
Status: 🟡 IN PROGRESS

### Sprint Progress Overview

| Sprint | Name | Status | Completion |
|--------|------|--------|-----------|
| 1.1 | Project Bootstrap & Infrastructure Core | ✅ COMPLETE | 100% |
| 1.2 | Authentication & Question Content Model | ✅ COMPLETE | 100% |
| 2.1 | Admin Question Bank Management | ✅ COMPLETE | 100% |
| **2.2** | **Exam Assembly & Access Code System** | 🟡 In Progress | 58% |
| 3.1 | Exam Session Engine & Write Path | ⬜ Pending | — |
| 3.2 | Question Renderers & Proctoring | ⬜ Pending | — |
| 4.1 | Result Engine & Personal Analytics | ⬜ Pending | — |
| 4.2 | IRT Integration & Advanced Features | ⬜ Pending | — |
| 5.1 | Performance & Security Hardening | ⬜ Pending | — |
| 5.2 | Final Polish, UAT & Launch | ⬜ Pending | — |

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

---

## 🎯 Next Up: Sprint 2.2 Tasks

**Goal:** Admin can assemble and publish a complete exam; users can unlock locked exams using access codes.

### Backend — Sprint 2.2
1. [x] Exam blueprint generation API: create/update blueprint, availability check, seeded draft generation/regeneration, preview, publish validation
2. [x] Seed mock TSA generation bank: 50 standalone MATH questions, 3 READING bundles x10 questions, 10 SCIENCE bundles x5 questions
3. [ ] Manual Exam Management API: add/reorder math questions, add/reorder passage bundles
4. [ ] Access Code API: create/list/deactivate codes, atomic unlock flow
5. [ ] User Exam List API: list unlocked/public exams with question counts

### Frontend — Sprint 2.2
1. [x] Admin Exam Management UI: list exams, create metadata, edit blueprint JSON, check availability, generate/regenerate draft, preview section breakdown, publish/unpublish
2. [ ] Manual Exam Builder UI with drag ordering and item replacement
3. [ ] Access Code Management UI
4. [ ] User Exam Library unlock flow

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
| All-or-nothing grading | `MULTIPLE_CHOICE`, `TRUE_FALSE_MATRIX`, `DRAG_DROP`, `FILL_NUMBER` — partial credit forbidden |
| Migration-only workflow | Never use `prisma db push`. Always `prisma migrate dev`. |

### Tech Choices
| Decision | Rule |
|----------|------|
| Tailwind CSS | **v4 only**. CSS-first `@theme {}`. No `tailwind.config.js`. Plugin: `@tailwindcss/vite`. |
| Rich text format | **`RichTextNode[]` JSON** (NOT Markdown string). See `QuestionContentSpec.md`. |
| File storage | **Supabase Storage**. Public `images` bucket for question images; private `contributions` bucket with signed URLs for PDF/DOCX. |
| API versioning | URI versioning — all routes: `/api/v1/...` |
| Redis role | Answer buffer during sessions. Session state. Leaderboard sorted set. NOT for token blacklist. |
| Refresh token storage | Hashed in PostgreSQL `refresh_tokens` table. NOT Redis blacklist. |
| Answer sync pattern | Client buffers in Zustand → POST /sync to Redis → BullMQ worker flushes to PostgreSQL every 30s |
| `prisma db push` | **FORBIDDEN** on this project |
| **UI Mockup rule** | **Before coding UI**, ask the user for screenshots/mockups to replicate. If not provided, autonomously design using project CSS theme. |

### Question Types (5 total, defined in QuestionContentSpec.md v2.1)
```
SINGLE_CHOICE     → 1 correct option, radio
MULTIPLE_CHOICE   → N correct options, checkboxes, all-or-nothing
TRUE_FALSE_MATRIX → Đúng/Sai per statement, all-or-nothing
DRAG_DROP         → Items into slots, all-or-nothing
FILL_NUMBER       → Multiple blanks[], exact match, all-or-nothing
```

---

## 📁 Key Files Reference

| File | Purpose |
|------|---------|
| `docs/PROJECT_CONTEXT.md` | **THIS FILE** — Live project state (read first, update last) |
| `docs/execution_plan.md` | Full 5-month sprint plan with deliverables |
| `docs/QuestionContentSpec.md` | Canonical question content schema v2.1 |
| `.agents/AGENTS.md` | Agent rules — Prisma workflow, commit convention, checklists |
| `apps/api/prisma/schema.prisma` | Database schema — source of truth (18 tables) |
| `apps/web/src/index.css` | Tailwind v4 design tokens + component CSS |
| `apps/web/vite.config.ts` | Vite config — plugins, alias, proxy, code splitting |

---

## 🔧 Local Dev Environment

| Service | Container | Port | Status (as of last update) |
|---------|-----------|------|--------------------------|
| PostgreSQL 16 | `cbt_postgres` | 5432 | ✅ Working — 18 tables migrated |
| Redis 7 | `cbt_redis` | 6379 | ✅ Working |
| pgAdmin | `cbt_pgadmin` | 5050 | ✅ Working — server import uses password exec command |
| RedisInsight | `cbt_redisinsight` | 5540 | ✅ Working |
| NestJS API | — | 3000 | ⬜ Not started yet |
| Vite frontend | — | 5173 | ⬜ Not running (smoke-tested earlier in this task) |

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
