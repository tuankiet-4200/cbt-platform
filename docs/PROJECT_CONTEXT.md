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

> **Last updated:** 2026-07-05 (end of Sprint 1.1)

### Active Sprint
**Sprint 1.2 (Tuần 3–4) — Authentication & Question Content Model**  
Status: 🔴 NOT STARTED

### Sprint Progress Overview

| Sprint | Name | Status | Completion |
|--------|------|--------|-----------|
| 1.1 | Project Bootstrap & Infrastructure Core | ✅ COMPLETE | 100% |
| **1.2** | **Authentication & Question Content Model** | 🔴 Not started | 0% |
| 2.1 | Admin Question Bank Management | ⬜ Pending | — |
| 2.2 | Exam Assembly & Access Code System | ⬜ Pending | — |
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

## 🎯 Next Up: Sprint 1.2 Tasks

**Goal:** By end of Sprint 1.2, a user should be able to register, login, and an admin should be able to create a question.

### Backend — Sprint 1.2
1. **Auth module** (`apps/api/src/auth/`)
   - `POST /api/v1/auth/register`
   - `POST /api/v1/auth/login` → accessToken (15m) + refreshToken HttpOnly cookie (7d)
   - `POST /api/v1/auth/refresh` → Rotation + Reuse Detection
   - `POST /api/v1/auth/logout`
   - `JwtAuthGuard`, `RolesGuard`

2. **Question CRUD API** (Admin-only) — `apps/api/src/questions/`
   - `POST/GET/PATCH/DELETE /api/v1/admin/questions`
   - `PATCH /api/v1/admin/questions/:id/status`

3. **PassageBundle CRUD API** — `apps/api/src/questions/`
   - `POST/GET/PATCH /api/v1/admin/passage-bundles`
   - Validate: READING = exactly 10q, SCIENCE = exactly 5q

4. **Contribution Submission API** — `apps/api/src/contributions/`
   - `POST /api/v1/contributions` (multipart PDF/DOCX upload)
   - `GET /api/v1/contributions/mine`
   - `GET /api/v1/admin/contributions`
   - `PATCH /api/v1/admin/contributions/:id/status`

5. **File Upload** — `POST /api/v1/admin/upload` → S3/Cloudinary

### Frontend — Sprint 1.2
1. Login page (`/login`) — React Hook Form + Zod
2. Register page (`/register`)
3. Zustand `authStore` — user info + access token
4. TanStack Query auth hooks
5. Protected route wrapper
6. Axios instance with Bearer token + 401 refresh interceptor

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
| API versioning | URI versioning — all routes: `/api/v1/...` |
| Redis role | Answer buffer during sessions. Session state. Leaderboard sorted set. NOT for token blacklist. |
| Refresh token storage | Hashed in PostgreSQL `refresh_tokens` table. NOT Redis blacklist. |
| Answer sync pattern | Client buffers in Zustand → POST /sync to Redis → BullMQ worker flushes to PostgreSQL every 30s |
| `prisma db push` | **FORBIDDEN** on this project |

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
| pgAdmin | `cbt_pgadmin` | 8080 | ✅ Working |
| RedisInsight | `cbt_redisinsight` | 5540 | ✅ Working |
| NestJS API | — | 3000 | ⬜ Not started yet |
| Vite frontend | — | 5173 | ⬜ Not started yet |

```bash
# Start dev environment
npm run docker:up    # if containers not running
npm run dev          # starts api (3000) + web (5173) concurrently
```

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
