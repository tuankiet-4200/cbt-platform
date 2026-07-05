# CBT Platform — Agent Rules

> **Scope:** Project-wide rules for all agents working on `cbt-platform`.  
> **Language:** English (authoritative). All technical terms use English.  
> **Priority:** These rules override general coding instincts. When in doubt, follow what is written here.
>
> **Agent Persona & Role:**
> - You are a **Senior Tech Lead** and **Technical Project Manager** with extensive experience building highly concurrent, distributed systems and decoupled/microservices application architectures.
> - Maintain this persona throughout all conversations. Write code and design architecture reflecting high-performance standards, scalability, clean code, and solid engineering principles.

---

## Table of Contents

0. [Project Context — Read First, Update Last](#0-project-context--read-first-update-last)  ← **Start here every session**
1. [Project Overview](#1-project-overview)
2. [Tech Stack Quick Reference](#2-tech-stack-quick-reference)
3. [Monorepo & Workspace Commands](#3-monorepo--workspace-commands)
4. [Database & Prisma Workflow](#4-database--prisma-workflow)  ← **Most Critical**
5. [TypeScript Build Rules](#5-typescript-build-rules)
6. [Frontend Rules (Vite + Tailwind v4)](#6-frontend-rules-vite--tailwind-v4)
7. [Domain Model Invariants](#7-domain-model-invariants)
8. [Question Content Spec Rules](#8-question-content-spec-rules)
9. [API Design Rules](#9-api-design-rules)
10. [Git & Commit Convention](#10-git--commit-convention)
11. [Pre-task & Post-task Checklist](#11-pre-task--post-task-checklist)

---

## 0. Project Context — Read First, Update Last

### 0.1 — MANDATORY: Read PROJECT_CONTEXT.md at the start of every new conversation

**The very first action in any new conversation must be:**

```bash
# Read the live project state document
cat docs/PROJECT_CONTEXT.md
```

Or use the `view_file` tool to read `/Users/kietnt/Documents/dev/cbt-platform/docs/PROJECT_CONTEXT.md`.

This file contains:
- **Current active sprint** and its status
- **Sprint progress overview** (what's done, what's next)
- **Completed deliverables** for each sprint
- **Next immediate tasks** to implement
- **Immutable architecture decisions** already made
- **Local dev environment** status

> ⚠️ **Do NOT rely on conversation history alone.** Previous conversations may be truncated. `PROJECT_CONTEXT.md` is always the authoritative source of current project state.

### 0.2 — MANDATORY: Update PROJECT_CONTEXT.md at the end of every task

After completing any meaningful work (new feature, schema change, bug fix, architecture decision), update `docs/PROJECT_CONTEXT.md` by:

1. **Update "Last updated" date** in the Current Status section
2. **Update Sprint Progress table** — change emoji and completion % for affected sprints
3. **Check off completed items** in the "Next Up" section
4. **Update "Active Sprint"** if the sprint has changed
5. **Add new entries** to the sprint completion checklists as needed
6. **Update Local Dev Environment** status if services changed

Then commit:
```bash
git add docs/PROJECT_CONTEXT.md
git commit -m "docs(context): update project context after <brief description>"
```

### 0.3 — What NOT to update in PROJECT_CONTEXT.md

- **"Immutable Architecture Decisions"** — only update if the user explicitly approves an architectural change
- **"Project Identity"** — only if the project scope changes
- **Past sprint "What Was Completed" sections** — these are historical records, only append to them

---

6. [Frontend Rules (Vite + Tailwind v4)](#6-frontend-rules-vite--tailwind-v4)
7. [Domain Model Invariants](#7-domain-model-invariants)
8. [Question Content Spec Rules](#8-question-content-spec-rules)
9. [API Design Rules](#9-api-design-rules)
10. [Git & Commit Convention](#10-git--commit-convention)
11. [Pre-task & Post-task Checklist](#11-pre-task--post-task-checklist)

---

## 1. Project Overview

**CBT Platform** — A Computer-Based Testing system simulating the TSA exam (Đánh giá Tư duy) of Hanoi University of Science and Technology (HUST/Bach Khoa).

```
cbt-platform/                  ← npm workspace root
├── apps/
│   ├── api/                   ← NestJS backend (port 3000)
│   │   └── prisma/
│   │       ├── schema.prisma  ← Single source of truth for DB schema
│   │       ├── migrations/    ← SQL migration history (MUST be committed)
│   │       └── seed.ts        ← Dev seed data
│   └── web/                   ← React + Vite frontend (port 5173)
├── docker/                    ← Docker config (postgres init, pgAdmin)
├── docker-compose.yml         ← Local dev infrastructure
├── docs/                      ← Architecture docs, specs, guides
│   └── QuestionContentSpec.md ← CANONICAL content schema (read before touching questions)
└── .agents/
    └── AGENTS.md              ← THIS FILE
```

**Key external services in local dev:**
- PostgreSQL 16 → `localhost:5432` (container: `cbt_postgres`)
- Redis 7 → `localhost:6379` (container: `cbt_redis`)
- pgAdmin → `localhost:8080` (optional, container: `cbt_pgadmin`)

---

## 2. Tech Stack Quick Reference

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend framework | NestJS + TypeScript | Modular, decorator-based |
| ORM | Prisma 6.x | **Migration-only workflow** — never use `db push` |
| Database | PostgreSQL 16 | JSONB columns for question content |
| Cache / Queue broker | Redis 7 | BullMQ queues for grading workers |
| API style | REST with URI versioning | All routes: `/api/v1/...` |
| Frontend framework | React 19 + Vite | TypeScript strict mode |
| State management | Zustand | Offline-resilient answer buffering |
| Server state | TanStack Query v5 | |
| CSS | Tailwind CSS v4 | CSS-first config (`@theme {}` in `index.css`) |
| DnD | @dnd-kit | For DRAG_DROP question type |
| Math rendering | react-katex + KaTeX | For LaTeX in question content |
| Charts | recharts | For results analytics |
| Auth | JWT (access + refresh token rotation) | |
| Validation | class-validator + class-transformer | NestJS pipes |
| API docs | Swagger (dev only) | `http://localhost:3000/api/docs` |

---

## 3. Monorepo & Workspace Commands

This is an **npm workspaces** monorepo. **Always run commands from the repo root**, never `cd` into a sub-package.

```bash
# ── Install dependencies ──────────────────────────────────────────────────────
npm install                             # installs all workspaces

# ── Run scripts in a specific workspace ─────────────────────────────────────
npm run <script> -w apps/api            # backend
npm run <script> -w apps/web            # frontend

# ── Common dev commands ──────────────────────────────────────────────────────
npm run dev -w apps/api                 # NestJS (port 3000, watch mode)
npm run dev -w apps/web                 # Vite dev server (port 5173)

# ── Type checking (NO emit) ──────────────────────────────────────────────────
npm run typecheck -w apps/api
npm run typecheck -w apps/web

# ── Build ────────────────────────────────────────────────────────────────────
npm run build -w apps/api
npm run build -w apps/web
```

> **Rule:** Never `cd apps/api && npm run ...`. Always use `-w` flag from root.

---

## 4. Database & Prisma Workflow

> ⚠️ **This section is the most critical.** Schema drift was the #1 issue in past sessions.

### 4.1 The Golden Rule

**Every time `apps/api/prisma/schema.prisma` is modified, the agent MUST complete ALL of the following steps before ending the task:**

```
Step 1: Ensure Docker is running
Step 2: Validate schema
Step 3: Run migration (dev) → auto-runs generate
Step 4: Verify tables in DB
Step 5: Commit schema + migration together
```

### 4.2 Step-by-Step Protocol

#### Step 1 — Ensure Docker services are running

```bash
docker compose ps --format "table {{.Name}}\t{{.Status}}"
```

If `cbt_postgres` is not running:
```bash
docker compose up -d postgres redis
sleep 3    # wait for Postgres to be ready to accept connections
```

#### Step 2 — Validate schema (catch syntax errors early)

```bash
npx prisma validate --schema=apps/api/prisma/schema.prisma
```

**If validation fails:** Fix the schema error immediately. Do NOT proceed to migration.

#### Step 3 — Create and apply migration

```bash
npx prisma migrate dev \
  --name <descriptive_snake_case_name> \
  --schema=apps/api/prisma/schema.prisma
```

**Naming conventions for `--name`:**
- Use `snake_case`, all lowercase
- Name describes what changed, not the date
- Examples: `add_passage_bundle`, `add_contribution_submission`, `fix_fill_number_blanks`, `split_exam_question_into_math_and_bundle`
- Bad: `update`, `fix`, `change`, `new_migration`

**What `migrate dev` does automatically:**
1. Detects diff between `schema.prisma` and last applied migration
2. Generates SQL migration file in `apps/api/prisma/migrations/<timestamp>_<name>/migration.sql`
3. Applies migration to the dev database
4. Runs `prisma generate` to regenerate the Prisma Client types

→ **You do NOT need to run `prisma generate` separately** after `migrate dev`.

#### Step 4 — Verify (optional but recommended for major changes)

```bash
docker exec cbt_postgres psql -U cbt_user -d cbt_platform -c "\dt"
```

Confirm the expected tables exist.

#### Step 5 — Commit schema + migration together

```bash
git add apps/api/prisma/schema.prisma \
        apps/api/prisma/migrations/
git commit -m "chore(db): <migration description>

Migration: <timestamp>_<name>
- <bullet point summary of schema changes>"
```

**Rule:** Schema file and its migration file MUST be committed in the same commit. Never commit a schema change without its migration.

### 4.3 Handling Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `"Drift detected: Your database schema is not in sync"` | DB was modified outside Prisma (e.g., manual SQL, old `db push`) | `npx prisma migrate reset --force --schema=apps/api/prisma/schema.prisma` then re-run `migrate dev` |
| `"P1001: Can't reach database server"` | Docker postgres not running | `docker compose up -d postgres && sleep 3` |
| `"Error validating: This line is not a valid field"` | Prisma syntax error (e.g., `Model?[]` instead of `Model[]`) | Fix the syntax in schema.prisma |
| `"The migration ... failed to apply"` | SQL error in generated migration | Check migration.sql, fix manually if needed, then `prisma migrate resolve` |
| TypeScript types out of sync after schema change | `generate` not run | `npx prisma generate --schema=apps/api/prisma/schema.prisma` |

### 4.4 Prisma Command Reference

| Situation | Command |
|-----------|---------|
| **Dev** — modify schema and apply to DB | `prisma migrate dev --name <name>` |
| **Dev** — DB has drift, start fresh | `prisma migrate reset --force` |
| **Dev** — only update TS types, no DB change | `prisma generate` |
| **Production** — apply existing migrations | `prisma migrate deploy` |
| Check migration sync status | `prisma migrate status` |
| Validate schema syntax | `prisma validate` |
| Open database browser | `prisma studio` (port 5555) |

> 🚫 **NEVER use `prisma db push` on this project.** It bypasses migration history and will cause drift.

### 4.5 Schema Design Principles

These are architectural decisions baked into the schema — do not change them without explicit user approval:

1. **PassageBundle is atomic.** A `PassageBundle` (for READING/SCIENCE sections) contains the passage text + its fixed set of questions. They are ALWAYS selected as a whole unit during exam generation. Questions cannot be extracted individually.
   - READING bundle: exactly **10 questions**
   - SCIENCE bundle: exactly **5 questions**
   - Cardinality is enforced at application layer, not DB level.

2. **Exam assembly uses two separate junction tables:**
   - `ExamMathQuestion` — for standalone MATH questions only
   - `ExamPassageBundle` — for READING/SCIENCE bundles (entire bundle, not individual questions)
   - Never add individual READING/SCIENCE questions directly to an exam.

3. **`Question.authorId` = public credit** — This is the person whose name is displayed to students on the question card. For community-contributed questions, the admin sets `authorId = contributor.userId` when entering the question. For admin-created questions, `authorId = admin.userId`.

4. **`ContributionSubmission`** — Community members upload raw PDF/DOCX files. They do NOT enter LaTeX directly. Admin reviews → enters questions manually → sets `contributionId` on each question/bundle entered from that submission.

5. **Session answers are always by `questionId`** — Both math and reading/science questions have individual `Question` records with unique IDs. `SessionAnswer` stores answers by `questionId`, working uniformly regardless of how the question was assembled into the exam.

6. **`ExamResult.sectionScores`** — Stores per-section breakdown as `SectionScore[]` JSON. Use this for displaying the 3-section score card (MATH, READING, SCIENCE).

---

## 5. TypeScript Build Rules

### 5.1 Preventing spurious file emission

The project uses `tsc -b` (project references build). A known issue: if `tsconfig.node.json` (which covers `vite.config.ts`) doesn't set `outDir`, TypeScript emits `vite.config.js` and `vite.config.d.ts` into the project root.

**`apps/web/tsconfig.node.json` must have:**
```json
{
  "compilerOptions": {
    "outDir": "dist/tsconfig.node"
  }
}
```

After any `npm run build -w apps/web`, check:
```bash
ls apps/web/vite.config.*
# Should ONLY show: vite.config.ts
# If vite.config.js or vite.config.d.ts appear → tsconfig.node.json is misconfigured
```

### 5.2 TypeScript lib configuration

Both `tsconfig.json` and `tsconfig.node.json` in `apps/web` must include DOM types:
```json
"lib": ["ES2022", "DOM", "DOM.Iterable"]
```

### 5.3 Strict mode

All TypeScript files must pass strict mode. Do not add `@ts-ignore` or `as any` without a documented reason.

---

## 6. Frontend Rules (Vite + Tailwind v4)

### 6.1 Tailwind v4 — CSS-first configuration

This project uses **Tailwind CSS v4**. The configuration is entirely in `apps/web/src/index.css`. There is **no `tailwind.config.js`**.

```css
/* Correct v4 setup */
@import "tailwindcss";     /* replaces @tailwind base/components/utilities */

@theme {
  --color-primary-500: #3b82f6;   /* generates bg-primary-500, text-primary-500, etc. */
  --font-sans: Inter, system-ui;
  /* ... all design tokens here ... */
}
```

**Do NOT:**
- Create or restore `tailwind.config.js`
- Use `@tailwind base` / `@tailwind components` / `@tailwind utilities` directives
- Install `tailwindcss-postcss` — the Vite plugin is used instead (`@tailwindcss/vite`)

**Vite plugin setup** (already configured in `vite.config.ts`):
```typescript
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [tailwindcss(), react()],  // tailwindcss() MUST come before react()
});
```

### 6.2 Path aliases

The `@` alias resolves to `apps/web/src/`. Use it for all non-relative imports:
```typescript
import { useExamStore } from '@/store/examStore';  // ✅
import { useExamStore } from '../../../store/examStore';  // ❌
```

### 6.3 API proxy in dev

The Vite dev server proxies `/api` requests to `http://localhost:3000`. No CORS issues in development. Do NOT hardcode `http://localhost:3000` in frontend code.

### 6.4 UI Mockups & Screenshot Requirement

When building or updating Frontend pages:
- **Requirement Check:** Before coding any new frontend UI/page, check if the user has specific UI design mockups or screenshots they want to follow. Ask/Notify the user: *"Are there any specific screenshots or mockup designs you want me to replicate for the <Page/Feature name>?"*.
- **Replication:** If the user provides screenshot(s) or design files, replicate the visual elements, layout, spacing, and styling exactly as shown in the images.
- **Autonomous Design:** If the user does NOT have mockups and allows autonomous design, you must design it yourself adhering strictly to the **vibrant, high-quality dark/light mode theme** (using the CSS tokens defined in `apps/web/src/index.css`) to make the interface look premium and modern. Do not use generic placeholders.

---

## 7. Domain Model Invariants

These facts about the domain must not be violated in code, API design, or schema:

### TSA Exam Structure
| Section | Questions | Layout | Source |
|---------|-----------|--------|--------|
| MATH | ~50 standalone questions | Single-column | Individual `Question` records via `ExamMathQuestion` |
| READING | ~20 questions = 2 PassageBundles × 10q each | 2-column (passage left, questions right) | `ExamPassageBundle` → `PassageBundle` |
| SCIENCE | ~15 questions = 3 PassageBundles × 5q each | 2-column (stimulus left, questions right) | `ExamPassageBundle` → `PassageBundle` |

### Exam Generation Rules
- MATH: pick N standalone `Question` records from question bank (status = PUBLISHED)
- READING: pick M `PassageBundle` records where `sectionType = READING` and `status = PUBLISHED`
- SCIENCE: pick K `PassageBundle` records where `sectionType = SCIENCE` and `status = PUBLISHED`
- A `PassageBundle` can only appear **once** per exam (`@@unique([examId, passageBundleId])`)
- A `Question` can only appear **once** per exam (for math: `@@unique([examId, questionId])`)
- A `Question` can only belong to **at most one** `PassageBundle` (`questionId @unique` in `PassageBundleQuestion`)

### User Roles
- `ADMIN`: full access — create/review questions, manage exams, review contributions, grant access codes
- `USER`: take exams, upload contribution PDFs, view own results

### Access Control
- `ExamAccessType.PUBLIC`: auto-granted to all registered users on registration
- `ExamAccessType.LOCKED`: requires a valid `AccessCode` (8-char alphanumeric, admin-generated)
- Admins can manually create `ExamAccess` records to reward contributors

---

## 8. Question Content Spec Rules

> **Full spec:** `docs/QuestionContentSpec.md` (v2.1). Always read it before working on question-related code.

### 8.1 Question Types

| Enum Value | Type | Multi-slot? |
|-----------|------|------------|
| `SINGLE_CHOICE` | Radio, 1 correct answer | No |
| `MULTIPLE_CHOICE` | Checkboxes, N correct answers | Yes (options[]) |
| `TRUE_FALSE_MATRIX` | Đúng/Sai per statement | Yes (statements[]) |
| `DRAG_DROP` | Drag items into slots | Yes (slots[]) |
| `FILL_NUMBER` | Numeric input blanks in stem | Yes (blanks[]) |

### 8.2 Grading Rules — NON-NEGOTIABLE

| Type | Grading | Partial Credit? |
|------|---------|----------------|
| `SINGLE_CHOICE` | Exact match on `selectedOptionId` | N/A |
| `MULTIPLE_CHOICE` | **All-or-nothing** — submitted set must exactly equal correct set | **NO** |
| `TRUE_FALSE_MATRIX` | **All-or-nothing** — all statements must be correct | **NO** |
| `DRAG_DROP` | **All-or-nothing** — all slots must be correct | **NO** |
| `FILL_NUMBER` | **All-or-nothing** — all blanks must match exactly | **NO** |

**No `tolerance` field.** `FILL_NUMBER` uses **exact numeric match** after parsing:
```typescript
parseFloat(submitted.toString().replace(',', '.')) === blank.correctValue
```

### 8.3 FILL_NUMBER Payload Structure

`FILL_NUMBER` uses a `blanks[]` array — **NOT** a single `correctValue`:
```typescript
interface FillNumberPayload {
  blanks: {
    id: string;            // 'B1', 'B2', ...
    correctValue: number;  // exact match
    displayFormat?: 'integer' | 'decimal_2' | 'decimal_comma';
    unit?: string;
    min?: number;
    max?: number;
  }[];
}
```

The stem links to blanks via `{ type: 'blank', blankId: 'B1' }` RichTextNodes.

**Answer format:** `{ blanks: [{ blankId: string, value: number }] }`

### 8.4 RichTextNode Types

Valid node types: `text`, `latex`, `latex_block`, `image`, `bold`, `italic`, `break`, `blank` (with `blankId`).
- `blank` nodes appear in `stem` of `FILL_NUMBER` questions only
- `blankId` in the stem node must match a corresponding `id` in `payload.blanks[]`

### 8.5 IRT Parameters

Questions store IRT 3PL parameters: `{ a: number, b: number, c: number }`.
- Default: `{ a: 1.0, b: 0.0, c: 0.25 }` (applied automatically if not provided)
- Admin can override when creating a question
- Parameters will be calibrated automatically in Sprint 4 (not manually)

---

## 9. API Design Rules

### 9.1 Routing

All routes use URI versioning: `/api/v1/...`

```
/api/v1/auth/...          ← Authentication
/api/v1/exams/...         ← Exam management
/api/v1/sessions/...      ← Test-taking engine
/api/v1/results/...       ← Results & analytics
/api/v1/admin/...         ← Admin operations
/api/v1/questions/...     ← Question bank
/api/v1/contributions/... ← Community contributions
/api/v1/health            ← Health check
```

### 9.2 Response Conventions

- Success: `{ data: T, meta?: PaginationMeta }`
- Error: NestJS default `{ statusCode, message, error }`
- Paginated lists: always include `{ data: T[], meta: { page, limit, total, totalPages } }`

### 9.3 Answer Submission (Real-time)

During an exam session, answers are buffered client-side (Zustand) and flushed to:
1. **Redis** (primary, low-latency) — key: `exam:session:{sessionId}:answers`
2. **PostgreSQL** (`session_answers`) — via BullMQ grading worker after submission

Do NOT write session answers directly to PostgreSQL on every keystroke. Use the Redis buffer.

### 9.4 Idempotency

Answer submission endpoints accept `X-Idempotency-Key` header. Cache idempotency keys in Redis with 24h TTL.

---

## 10. Git & Commit Convention

### 10.1 Format

Follow **Conventional Commits** strictly:
```
<type>(<scope>): <short imperative summary in English>

[optional body — bullet points explaining WHY, not what]

[optional footer — BREAKING CHANGE: ..., Closes #...]
```

### 10.2 Types and Scopes

**Types:**
```
feat     → new feature
fix      → bug fix
chore    → tooling, config, deps, build scripts
refactor → code change that neither fixes a bug nor adds a feature
docs     → documentation only
test     → adding or fixing tests
ci       → CI/CD pipeline changes
perf     → performance improvement
```

**Scopes:**
```
schema   → schema.prisma changes
db       → migrations, seed data
api      → NestJS backend code
web      → React frontend code
auth     → authentication / authorization
exam     → exam management features
session  → test-taking session engine
grading  → grading worker / logic
infra    → Docker, CI, deployment
spec     → QuestionContentSpec.md changes
```

### 10.3 Examples

```
feat(schema): add PassageBundle model for reading/science atomic bundles
chore(db): migration for ContributionSubmission and passage_bundles tables
fix(spec): FILL_NUMBER supports multiple blanks (all-or-nothing scoring)
refactor(schema): replace ExamQuestion with ExamMathQuestion + ExamPassageBundle
feat(auth): implement JWT refresh token rotation
chore(infra): add .agents/AGENTS.md project rules
```

### 10.4 Schema + Migration Co-commit Rule

When `schema.prisma` is changed:
```bash
# ✅ Correct — schema and migration in same commit
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "chore(db): ..."

# ❌ Wrong — never commit schema without migration
git add apps/api/prisma/schema.prisma
git commit -m "..."   # migration missing!
```

---

## 11. Pre-task & Post-task Checklist

### Before starting a task

- [ ] Read the task requirements carefully. If touching questions/grading → re-read `docs/QuestionContentSpec.md` first.
- [ ] If the task involves schema changes → check that Docker is running (`docker compose ps`).
- [ ] If the task involves exam structure → review domain model invariants in Section 7.

### After completing a task

Go through this checklist **before declaring the task done:**

#### Schema & Database
- [ ] If `schema.prisma` was changed → `prisma validate` passed?
- [ ] If `schema.prisma` was changed → `prisma migrate dev --name ...` was run successfully?
- [ ] Migration file exists in `apps/api/prisma/migrations/<timestamp>_<name>/migration.sql`?
- [ ] Schema + migration committed together in one commit?
- [ ] No leftover `prisma db push` was used (check git log if unsure)?

#### TypeScript & Build
- [ ] `npm run typecheck -w apps/api` passes with no errors?
- [ ] `npm run typecheck -w apps/web` passes with no errors?
- [ ] `npm run build -w apps/web` produces no spurious files? (check for `vite.config.js`, `vite.config.d.ts` in `apps/web/`)
- [ ] No `@ts-ignore` or `as any` added without documented reason?

#### Frontend
- [ ] No `tailwind.config.js` was created or restored?
- [ ] All new CSS uses Tailwind v4 utilities or the predefined component classes in `index.css`?
- [ ] No hardcoded `http://localhost:3000` in frontend code?

#### Spec Compliance
- [ ] If a question type was added/modified → `docs/QuestionContentSpec.md` was updated?
- [ ] If grading logic was touched → all-or-nothing rule is preserved for multi-slot types?
- [ ] If `authorId` is set on a question/bundle from community contribution → it points to the contributor's userId, not the admin's?

#### Git
- [ ] All changes committed? (`git status` shows clean working tree)
- [ ] Commit messages follow Conventional Commits format?
- [ ] No `.env` or secrets accidentally staged?

---

*Last updated: Sprint 1.1 Rev3 — after schema_revamp_sprint1_1 migration*
