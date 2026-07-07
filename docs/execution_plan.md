# 🎯 Kế Hoạch Triển Khai 5 Tháng — Nền Tảng CBT Mô Phỏng TSA HUST

> **Tech Lead Note:** Thứ tự ưu tiên tổng quát: **Infrastructure → Data Model → Core API → Core UI → Feature Layers → Hardening**. Mỗi quyết định kiến trúc ở tháng 1 sẽ quyết định tốc độ của tháng 4–5. Đừng cắt góc ở giai đoạn nền móng.

> **Last updated:** Sprint 1.1 complete. Schema v2.1 + ContributionSubmission in production-dev.

---

## 📋 Tổng Quan Lộ Trình

| Tháng | Theme | Mục tiêu trọng tâm |
|-------|-------|-------------------|
| **Tháng 1** | Foundation | Infra, DB Schema, Auth, Question Model |
| **Tháng 2** | Core Engine | Question Bank Admin, Exam Assembly, Exam Session |
| **Tháng 3** | Exam Experience | Exam UI, Real-time Sync, Proctoring, Grading |
| **Tháng 4** | Analytics & Access | Result Engine, IRT Analytics, Access Control |
| **Tháng 5** | Hardening | Load Testing, Security Audit, Polish, Launch |

---

## 🏗️ THÁNG 1 — Foundation & Infrastructure

> **Triết lý:** Không một dòng feature code nào được viết trước khi nền móng vững chắc. Tháng này là "đầu tư không thể hoàn lại".

### Sprint 1.1 (Tuần 1–2) — Project Bootstrap & Infrastructure Core ✅ DONE

#### Backend Deliverables
- [x] **Project scaffolding:** NestJS monorepo với cấu trúc module (`auth`, `users`, `questions`, `exams`, `sessions`, `analytics`, `admin`, `common`). Prisma, class-validator, BullMQ.
- [x] **Docker Compose:** PostgreSQL 16, Redis 7, pgAdmin, RedisInsight. `.env.example` với mọi biến môi trường.
- [x] **Database Schema v2.1 (Prisma) — MIGRATED:** Các bảng cốt lõi:
  - `users`, `refresh_tokens`
  - `tags`, `question_tags`
  - `questions` — `contentJson JSONB` theo [QuestionContentSpec.md v2.1](./QuestionContentSpec.md)
  - `passage_bundles`, `passage_bundle_questions` — **Atomic unit cho READING/SCIENCE** (xem §Domain Rules)
  - `exams`, `exam_math_questions`, `exam_passage_bundles` — Thay thế `exam_questions` cũ
  - `access_codes`, `exam_accesses`
  - `exam_sessions`, `session_answers`, `exam_results`
  - `proctoring_events`
  - `contribution_submissions` — Community PDF/DOCX upload workflow
- [x] **Redis namespace strategy:** `session:{id}:answers`, `session:{id}:timing`, `leaderboard:{examId}`
- [x] **CI/CD Pipeline:** GitHub Actions — lint → typecheck → build. Pass trước khi merge.

#### Frontend Deliverables
- [x] **Project scaffolding:** Vite + React 19 + TypeScript strict mode.
- [x] **Tailwind CSS v4** (CSS-first `@theme {}` trong `index.css`, plugin `@tailwindcss/vite`). **Không có `tailwind.config.js`**.
- [x] **Design System tokens:** color palette, typography (Inter), spacing, shadows trong `index.css`.
- [x] **Layout shell:** `RootLayout`, `AuthLayout`, `ExamLayout`. React Router.
- [x] **Shared UI component classes:** `.card`, `.btn`, `.input`, `.badge`, `.q-nav-item` trong CSS layer.

#### ⚠️ Rủi ro Sprint 1.1 — ĐÃ XỬ LÝ
> **R1 — Schema Lock-in:** ✅ Đã giải quyết — `QuestionContentSpec.md` v2.1 đã draft đầy đủ 5 loại câu hỏi. Schema `PassageBundle` atomic đã migrate.

---

### Sprint 1.2 (Tuần 3–4) — Authentication & Question Content Model

#### Backend Deliverables
- [ ] **Auth Module (JWT + Refresh Token):**
  - `POST /api/v1/auth/register` → Hash password (bcrypt, rounds=12), tạo User, tự động grant ExamAccess cho default exam (PUBLIC).
  - `POST /api/v1/auth/login` → Trả về `accessToken` (15 phút) + `refreshToken` (7 ngày, lưu HttpOnly Cookie).
  - `POST /api/v1/auth/refresh` → Rotate refresh token.
  - `POST /api/v1/auth/logout` → Revoke refresh token (mark `isRevoked = true` trong DB, NOT Redis blacklist — xem R3).
  - Guards: `JwtAuthGuard`, `RolesGuard` (`ADMIN`, `USER`).
- [ ] **Question Content Validation (class-validator):** Zod/class-validator DTO cho toàn bộ `contentJson` — match chính xác [QuestionContentSpec.md v2.1](./QuestionContentSpec.md):
  ```typescript
  // 5 types hiện tại:
  type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE_MATRIX' | 'DRAG_DROP' | 'FILL_NUMBER';
  // FILL_NUMBER dùng blanks[] array — KHÔNG phải correctValue đơn lẻ
  // Không có tolerance — exact numeric match
  ```
- [ ] **IRT Params Schema & Defaults:**
  ```typescript
  interface IrtParams { a: number; b: number; c: number; }
  const DEFAULT_IRT: IrtParams = { a: 1.0, b: 0.0, c: 0.25 }; // Auto-applied nếu không truyền
  ```
- [ ] **Question CRUD API (Admin-only):**
  - `POST /api/v1/admin/questions` — tạo standalone MATH question (hoặc câu cho PassageBundle)
  - `GET /api/v1/admin/questions` — list với filter
  - `PATCH /api/v1/admin/questions/:id`
  - `DELETE /api/v1/admin/questions/:id`
  - `PATCH /api/v1/admin/questions/:id/status` → `DRAFT → PENDING_REVIEW → PUBLISHED → ARCHIVED`
- [ ] **PassageBundle CRUD API (Admin-only):**
  - `POST /api/v1/admin/passage-bundles` — tạo bundle + upload passage text + link questions
  - `GET /api/v1/admin/passage-bundles` — list với filter `sectionType`, `status`
  - `PATCH /api/v1/admin/passage-bundles/:id`
  - **Validation tại app layer:** READING bundle = đúng 10 câu, SCIENCE bundle = đúng 5 câu
- [ ] **Contribution Submission API (Community):**
  - `POST /api/v1/contributions` — User upload PDF/DOCX (multipart). Lưu file URL + metadata vào `contribution_submissions`.
  - `GET /api/v1/contributions/mine` — User xem submissions của mình + status.
  - `GET /api/v1/admin/contributions` — Admin list tất cả submissions (filter by status).
  - `PATCH /api/v1/admin/contributions/:id/status` — Admin đổi `PENDING → REVIEWING → APPROVED | REJECTED`, kèm `adminNote`.
- [x] **File Upload:** `POST /api/v1/admin/upload` → Upload ảnh lên Supabase Storage bucket `images`, trả về public URL để nhúng vào `contentJson`. Contribution files upload vào private bucket `contributions`, truy cập qua signed URL.

#### Frontend Deliverables
- [ ] **Auth flows:** Trang Login, Register (React Hook Form + Zod). Zustand `authStore` lưu user info + token. TanStack Query `useAuth` hooks.
- [ ] **Protected routes:** Middleware check JWT, redirect về `/login`. Admin routes check `role === 'ADMIN'`.
- [ ] **Axios interceptor:** Tự động attach `Authorization: Bearer <token>`, gọi `/auth/refresh` khi nhận 401, retry request gốc.

#### ⚠️ Rủi ro Sprint 1.2
> **R2 — Rich Text Format:** ✅ ĐÃ QUYẾT ĐỊNH — Dùng **structured `RichTextNode[]` JSON** (không phải Markdown string). Đây là quyết định cố định, không thay đổi. Chi tiết xem [QuestionContentSpec.md](./QuestionContentSpec.md).

> **R3 — Refresh Token Security:** Phải implement **Refresh Token Rotation** + **Reuse Detection**. Token lưu dưới dạng hash trong DB (`refresh_tokens` table), không dùng Redis blacklist. Khi reuse detected → revoke toàn bộ token của user (security breach response).

---

## 🔧 THÁNG 2 — Core Engine: Question Bank & Exam Management

> **Triết lý:** Cuối tháng 2, Admin phải có thể ngồi nhập câu hỏi và tạo ra một đề thi hoàn chỉnh. Đây là MVP nội bộ để test data flow.

### Sprint 2.1 (Tuần 5–6) — Admin Question Bank Management

#### Backend Deliverables
- [x] **Tag / Taxonomy API:**
  - `GET /api/v1/admin/tags` → Trả về cây taxonomy (Subject → Chapter → Topic → SubTopic), depth 0–3.
  - `POST /api/v1/admin/tags` → Tạo tag mới với `parentId`, `slug`, `orderIndex`.
  - `GET /api/v1/admin/questions?tagId[]=...&type=...&level=...&status=...` → Search câu hỏi theo tag, level, type, status.
- [x] **Question Review Workflow:** `PATCH /api/v1/admin/questions/:id/status` → Chuyển trạng thái với `reviewNote`.
- [x] **Bulk Import API (Phase 1):** `POST /api/v1/admin/questions/bulk` → Nhận mảng JSON questions, validate từng item, insert theo batch. Phục vụ nhập tay hàng loạt.
- [x] **Filtering & Pagination:** Tất cả list endpoints hỗ trợ `page`, `limit`, `sortBy`, `tagId[]`, `level`, `type`, `status` — trả về `{ data: T[], meta: { page, limit, total, totalPages } }`.

#### Frontend Deliverables
- [x] **Admin Dashboard Layout:** Sidebar navigation: Unified Question Content, Contributions, Exams, Users, Access Codes, Analytics.
- [x] **Question List Page:** DataTable với filter panel. Pagination. Bulk select + action (Archive, Publish).
- [x] **Question Detail / Create Form:**
  - Dynamic form: dropdown chọn `type` → render phần payload tương ứng (choices cho SINGLE/MULTIPLE, statements cho TRUE_FALSE, items+slots cho DRAG_DROP, blanks[] cho FILL_NUMBER).
  - LaTeX preview real-time (dùng `react-katex` + `<MathRenderer/>`).
  - IRT params input với tooltip giải thích ý nghĩa a/b/c.
  - Tag selector (multi-select với tree search).
- [x] **PassageBundle Create Form:** Upload passage text (RichTextNode[] editor), link câu hỏi vào bundle, validate đúng số lượng (10 READING / 5 SCIENCE).
- [x] **Unified Section Content Bank:** `/admin/questions` gộp MATH / READING / SCIENCE; MATH gắn tag cho question, READING/SCIENCE gắn tag cho PassageBundle và nhập 10/5 câu hỏi liên quan trong cùng flow.
- [x] **Contribution Review UI (Admin):** List submissions với status filter. Click → xem file preview (PDF/DOCX embed), form nhập `adminNote`, nút Approve/Reject/set Reviewing.
- [x] **Bulk JSON Import UI:** Paste JSON payload, validate shape client-side, submit to bulk import API.
- [x] **Admin Auth/Theme Hardening:** New-tab session bootstrap via refresh cookie; Admin primary palette aligned to TSA red branding.

#### ⚠️ Rủi ro Sprint 2.1
> **R4 — Admin UX Bottleneck:** Nếu form nhập câu hỏi phức tạp và chậm, Admin sẽ từ chối dùng. **Giải pháp:** Ưu tiên tốc độ nhập liệu: keyboard shortcuts, auto-save draft, copy-paste LaTeX từ Word/Google Docs.

---

### Sprint 2.2 (Tuần 7–8) — Exam Assembly & Access Code System

#### Backend Deliverables
- [ ] **Exam Management API (Admin):**
  - `POST /api/v1/admin/exams` → Tạo đề thi với metadata.
  - `POST /api/v1/admin/exams/:id/math-questions` → Thêm MATH question vào đề qua `ExamMathQuestion` (orderInSection, points).
  - `POST /api/v1/admin/exams/:id/passage-bundles` → Thêm PassageBundle vào đề qua `ExamPassageBundle` (sectionType, orderInSection). **Không thể thêm câu hỏi lẻ từ bundle.**
  - `GET /api/v1/admin/exams/:id/preview` → Preview toàn bộ đề: section breakdown (MATH/READING/SCIENCE), tổng câu, tổng điểm, thời gian dự kiến.
  - `PATCH /api/v1/admin/exams/:id/publish` → Publish đề (chỉ published exam mới được thi).
- [ ] **Access Code System:**
  - `POST /api/v1/admin/access-codes` → Tạo code với `examId`, `maxUses`, `expiresAt`. Mã 8 ký tự alphanumeric uppercase.
  - `POST /api/v1/exams/unlock` → User nhập code → atomic check-and-increment `usedCount` → insert `ExamAccess`.
  - Auto-grant default exam (PUBLIC) khi User được tạo.
- [ ] **User Exam List API:** `GET /api/v1/exams` → Danh sách đề thi user đã unlock (JOIN `ExamAccess` + `ExamPassageBundle`/`ExamMathQuestion` count).

#### Frontend Deliverables
- [ ] **Exam Builder UI (Admin):** Drag-and-drop sắp xếp (dùng @dnd-kit). Phân 3 section (MATH / READING / SCIENCE). Search & add từ question bank. Add PassageBundle nguyên khối (không thể add câu lẻ READING/SCIENCE).
- [ ] **Access Code Management (Admin):** Tạo, list, copy, deactivate codes. Hiển thị usage stats (usedCount/maxUses).
- [ ] **User Exam Library Page:** Grid/List các đề thi đã unlock. Card: title, duration, số câu, trạng thái. Ô nhập mã để unlock đề mới.

#### ⚠️ Rủi ro Sprint 2.2
> **R5 — Access Code Race Condition:** `maxUses` phải check + increment atomically. **Giải pháp:** `UPDATE access_codes SET used_count = used_count + 1 WHERE id = $1 AND used_count < max_uses RETURNING *` trong một transaction. Nếu 0 rows returned → code đã hết lượt.

---

## 🖥️ THÁNG 3 — Exam Experience: Session Engine & Proctoring

> **Triết lý:** Đây là tháng khó nhất và quan trọng nhất về mặt kỹ thuật. Session engine phải bulletproof. Mọi thứ phải work kể cả khi mạng không ổn định.

### Sprint 3.1 (Tuần 9–10) — Exam Session Engine & Write Path

#### Backend Deliverables
- [ ] **Session Lifecycle API:**
  - `POST /api/v1/sessions` → Tạo session cho `(userId, examId)`. Check access. Resume nếu đã có `IN_PROGRESS`. Lưu `startTime`, tính `endTime = startTime + durationMins * 60s`.
  - `GET /api/v1/sessions/:id` → Session metadata + exam payload theo cấu trúc:
    ```typescript
    interface ExamPayload {
      math: { question: QuestionContent; orderInSection: number; points: number }[];
      reading: { bundle: PassageBundleContent; orderInSection: number }[];   // passage + 10 câu
      science: { bundle: PassageBundleContent; orderInSection: number }[];   // passage + 5 câu
    }
    // KHÔNG trả về đáp án đúng (isCorrect, correctValue, correctItemId...)
    ```
  - `PATCH /api/v1/sessions/:id/submit` → Đặt `status = SUBMITTED`, `submittedAt = NOW()`. Đẩy grading job vào BullMQ `grading-queue`.
- [ ] **Answer Sync API (Redis Buffer):**
  - `POST /api/v1/sessions/:id/sync` → Nhận batch `[{questionId, answerJson, timeSpentMs}]`. Ghi `HSET session:{id}:answers {questionId} {json}`. Trả về `{ok: true}` ngay (không chờ DB).
  - Header: `X-Idempotency-Key` — cache trong Redis 24h.
  - **Auto-flush BullMQ job:** Mỗi 30 giây flush Redis → `session_answers` PostgreSQL. Cũng flush khi submit.
- [ ] **Session State Recovery:** `GET /api/v1/sessions/:id/state` → Lấy từ Redis (nếu còn) hoặc PostgreSQL (fallback).

#### Frontend Deliverables
- [ ] **Zustand `examStore`:**
  ```typescript
  interface ExamStore {
    sessionId: string;
    answers: Record<string, any>;    // questionId → answerJson
    timing: Record<string, number>;  // questionId → ms spent
    currentSection: 'MATH' | 'READING' | 'SCIENCE';
    currentIndex: number;
    globalTimeRemaining: number;     // ms, computed from server endTime
    questionStartTime: number;       // Date.now() khi chuyển câu
    status: 'idle' | 'in-progress' | 'submitted';
  }
  ```
  - Persist toàn bộ vào `localStorage` — key `exam_session_{sessionId}`.
  - Rehydrate khi reload.
- [ ] **Sync Service:** `useSyncService` hook — debounce 3s, batch `POST /api/v1/sessions/:id/sync`. Offline queue với `navigator.onLine` event.
- [ ] **Timer:** `<GlobalCountdown/>` — đổi màu đỏ khi < 5 phút. Tính từ server `endTime - Date.now()` (không decrement thuần túy).

#### ⚠️ Rủi ro Sprint 3.1
> **R6 — Double Submission:** Idempotency key + `@@unique([userId, examId])` trên `ExamSession` + nút submit disabled sau click đầu.

> **R7 — Redis Memory:** Pipeline writes. TTL 24h cho session keys. Monitor với `INFO memory`.

> **R8 — Timer Drift:** Server-authoritative `endTime`. Client tính `endTime - Date.now()` mỗi giây.

---

### Sprint 3.2 (Tuần 11–12) — Question Renderers & Proctoring

#### Backend Deliverables
- [ ] **Grading Worker (BullMQ queue: `grading-queue`, job: `grade-session`):**
  - Grading logic theo type — **all-or-nothing cho multi-slot, theo [QuestionContentSpec.md](./QuestionContentSpec.md):**
    - `SINGLE_CHOICE`: `answer.selectedOptionId === correctOption.id`
    - `MULTIPLE_CHOICE`: `sort(answer.selectedOptionIds) deepEqual sort(correctOptionIds)` — **all-or-nothing**
    - `TRUE_FALSE_MATRIX`: `statements.every(s => answer[s.id] === s.isTrue)` — **all-or-nothing**
    - `DRAG_DROP`: `slots.every(s => answer.slots[s.id] === s.correctItemId)` — **all-or-nothing**
    - `FILL_NUMBER`: `blanks.every(b => parseFloat(answer.blanks[b.id]) === b.correctValue)` — **exact match, all-or-nothing**
  - Tính `sectionScores[]` (MATH/READING/SCIENCE) — lưu vào `ExamResult.sectionScores` JSONB.
  - Lưu `ExamResult` (totalScore, maxScore, percentScore, correctCount, wrongCount, skippedCount, durationSecs).
  - Lưu chi tiết `SessionAnswer` (isCorrect, pointsEarned, timeSpentMs).
- [ ] **Proctoring Event API:** `POST /api/v1/sessions/:id/events` → Nhận events `TAB_SWITCH | FULLSCREEN_EXIT | COPY_ATTEMPT | SESSION_BLUR`. Lưu vào `proctoring_events`. **Không chặn luồng thi.**
- [ ] **Admin Proctoring API:** `GET /api/v1/admin/sessions/:id/events` → Timeline events.

#### Frontend Deliverables
- [ ] **Question Renderer System:**
  - `<QuestionRenderer type={q.type} content={q.content} />` — Dispatcher.
  - `<SingleChoiceQuestion/>`: Radio buttons, LaTeX support.
  - `<MultipleChoiceQuestion/>`: Checkboxes (tất cả phải chọn đúng).
  - `<TrueFalseMatrixQuestion/>`: Table N rows × 2 cols (Đúng/Sai), radio per row.
  - `<DragDropQuestion/>`: @dnd-kit. Mobile touch support.
  - `<FillNumberQuestion/>`: Render `blank` nodes trong stem thành `<input type="number">`. Map `blankId` → input.
  - `<PassageBundleView/>`: 2-column layout — passage text (trái) + câu hỏi (phải).
  - `<MathRenderer/>` wrap react-katex toàn cục.
- [ ] **Exam Interface Layout:**
  - Top bar: tên đề, countdown, nút Nộp bài.
  - Left panel: Question navigator — grid số câu, màu: xám (chưa làm), xanh (đã làm), vàng (đánh dấu). Tab section MATH/READING/SCIENCE.
  - Center: QuestionRenderer hoặc PassageBundleView.
  - Bottom: Previous / Next, Đánh dấu xem lại.
- [ ] **Proctoring Module:** `useProctoringMonitor` hook — fullscreen request, `visibilitychange`, `fullscreenchange`. Batch gửi events mỗi 10s. Warning modal khi vi phạm.
- [ ] **Submit Flow:** Confirmation modal (số câu đã làm/tổng, phân theo section). Loading. Redirect `/results/:sessionId`.

#### ⚠️ Rủi ro Sprint 3.2
> **R9 — Grading Worker Failure:** BullMQ retry exponential backoff (3 lần). Dead-letter queue. Alert khi fail.

> **R10 — DnD Mobile:** Test iOS Safari + Chrome Android. Fallback UI (dropdown) nếu cần.

---

## 📊 THÁNG 4 — Analytics, Results & Access Control Polish

> **Triết lý:** Tháng này biến dữ liệu thô thành insight có giá trị — đây là yếu tố giữ chân user và tạo differentiation.

### Sprint 4.1 (Tuần 13–14) — Result Engine & Personal Analytics

#### Backend Deliverables
- [ ] **Result API:**
  - `GET /api/v1/results/:sessionId` → Kết quả đầy đủ: `totalScore`, `sectionScores[]` (MATH/READING/SCIENCE), tagBreakdown, durationSecs.
  - `GET /api/v1/results/:sessionId/answers` → Từng câu: content, answerJson (user), correctAnswer, isCorrect, pointsEarned, timeSpentMs, solution. **Chỉ trả về đáp án đúng SAU KHI session đã SUBMITTED.**
- [ ] **Personal Analytics API:**
  - `GET /api/v1/analytics/me/exams/:examId` → Lịch sử lần thi, điểm, ngày.
  - `GET /api/v1/analytics/me/weaknesses` → Tỷ lệ đúng GROUP BY tag.
  - `GET /api/v1/analytics/me/time-analysis` → Avg time/question vs `expectedTimeSecs`.
- [ ] **Leaderboard API:** `GET /api/v1/exams/:examId/leaderboard` → Top 100 dùng Redis Sorted Set `ZADD leaderboard:{examId} score userId`. Update sau mỗi grading job.

#### Frontend Deliverables
- [ ] **Result Page (`/results/:sessionId`):**
  - Điểm số hero (totalScore/maxScore + percent).
  - **3-section score card**: MATH / READING / SCIENCE — dùng `sectionScores[]` từ `ExamResult`.
  - Radar chart 3 trục (Toán, Đọc hiểu, Khoa học) với `recharts`.
  - Tag breakdown bar chart.
- [ ] **Answer Review Page (`/results/:sessionId/review`):**
  - List câu hỏi với màu (xanh=đúng, đỏ=sai, xám=bỏ).
  - PassageBundle questions hiển thị trong 2-column layout với passage.
  - Click expand: full content, đáp án đúng, lời giải (RichTextNode rendered), timeSpentMs.
  - Filter: Chỉ sai / chỉ đánh dấu / chỉ bỏ.
- [ ] **Personal Analytics Dashboard:** Progress chart, điểm mạnh/yếu, "Cần cải thiện" section.

#### ⚠️ Rủi ro Sprint 4.1
> **R11 — Large Result Payload:** Lazy load câu hỏi trong review page. Pagination cho answer list. Server-side compression (đã enable `compression()` trong main.ts).

---

### Sprint 4.2 (Tuần 15–16) — IRT Integration & Advanced Features

#### Backend Deliverables
- [ ] **IRT Analytics Service:** Sau 100 submissions/câu, chạy job tính lại `b` từ empirical data.
  - `GET /api/v1/admin/questions/:id/irt-stats` → `p_correct`, `avg_time`, `discrimination_index`, current IRT params.
  - `GET /api/v1/admin/exams/:id/item-analysis` → Table phân tích từng câu: difficulty, discrimination, p_correct, flag bad items.
- [ ] **Notification:** Email khi kết quả chấm xong (nodemailer + BullMQ). Email khi access code hết.
- [ ] **Contribution Reward:** Sau khi `ContributionSubmission` → APPROVED, admin có thể tạo `ExamAccess` cho contributor để unlock thêm đề.

#### Frontend Deliverables
- [ ] **Leaderboard Page:** Polling 30s khi đang trong giờ thi. Highlight user's rank.
- [ ] **Admin Item Analysis Dashboard:** Sortable table, color-coded difficulty, histogram phân phối đáp án.
- [ ] **Contribution UI (User):** Upload form (PDF/DOCX, max 50MB), track submission status với timeline (PENDING → REVIEWING → APPROVED/REJECTED), xem adminNote.
- [ ] **User Settings:** Đổi mật khẩu, lịch sử thi, quản lý đề đã unlock.

#### ⚠️ Rủi ro Sprint 4.2
> **R12 — IRT Accuracy:** Với N < 50 submissions/câu, hiển thị disclaimer "Chưa đủ dữ liệu". Đừng overclaim.

---

## 🔒 THÁNG 5 — Hardening, Security Audit & Launch

> **Triết lý:** Feature freeze sau tháng 4. Tháng 5 chỉ fix bugs, tối ưu performance, đảm bảo survive ngày đầu launch.

### Sprint 5.1 (Tuần 17–18) — Performance & Security Hardening

#### Backend Tasks
- [ ] **Load Testing (k6/Artillery):**
  - Scenario 1: 300 users đồng thời `POST /api/v1/sessions` trong 60s.
  - Scenario 2: 500 users `POST /api/v1/sessions/:id/sync` mỗi 5s trong 90 phút.
  - Scenario 3: 300 users `PATCH /api/v1/sessions/:id/submit` trong 5s.
  - **Target SLA:** p95 latency < 500ms. Error rate < 0.1%.
- [ ] **Database Optimization:** `EXPLAIN ANALYZE` queries phổ biến. Indexes: `(userId, examId)` trên `exam_sessions`, `(examId, totalScore DESC)` trên `exam_results`. Connection pooling: PgBouncer hoặc Prisma `connection_limit`.
- [ ] **GIN Index on contentJson:** Manual migration SQL: `CREATE INDEX CONCURRENTLY ON questions USING GIN (content_json jsonb_path_ops)` (xem `docs/manual_indexes.sql`).
- [ ] **Security Audit:**
  - Prisma parameterized queries — verify không có raw query nguy hiểm.
  - Rate limiting: `@nestjs/throttler` — 10 req/s auth, 100 req/s session sync.
  - Helmet.js (đã cấu hình trong `main.ts` — verify production mode).
  - File upload: validate MIME type + magic bytes cho PDF/DOCX. Max 50MB.
  - `npm audit` — fix high/critical.
- [ ] **Logging & Monitoring:** Structured JSON logs với `winston`. Sentry error tracking. Uptime monitor.

#### Frontend Tasks
- [ ] **Bundle Analysis:** `vite-bundle-visualizer` → lazy-load routes, lazy-load recharts, katex.
- [ ] **Core Web Vitals:** LCP < 2.5s, CLS < 0.1, FID < 100ms. Lighthouse CI.
- [ ] **Accessibility:** Keyboard navigation trong exam interface. ARIA labels. Contrast ratio.
- [ ] **Cross-browser:** Chrome, Firefox, Safari, Edge. Mobile: iOS Safari, Chrome Android.

#### ⚠️ Rủi ro Sprint 5.1
> **R13 — BullMQ Queue Overflow:** 300 jobs cùng lúc → horizontal scale workers. `concurrency: 10` per worker. Alert on queue depth.

---

### Sprint 5.2 (Tuần 19–20) — Final Polish, UAT & Launch

#### Backend Tasks
- [ ] **API Documentation:** Swagger (đã setup trong `main.ts`) — tại `http://localhost:3000/api/docs` (dev only).
- [ ] **DB Backup:** Automated daily backup PostgreSQL → S3. Test restore.
- [ ] **Graceful Shutdown:** `enableShutdownHooks()` đã có. Thêm BullMQ `worker.close()`.
- [ ] **Health Check:** `GET /api/v1/health` — DB + Redis + queue status. `@nestjs/terminus`.

#### Frontend Tasks
- [ ] **UAT:** Mời 10–20 học sinh thật. Thu thập feedback UX.
- [ ] **Onboarding Flow:** Tutorial overlay lần đầu vào trang thi.
- [ ] **Empty & Error States:** Không có đề, lỗi mạng, session hết hạn, 500.
- [ ] **SEO & Meta:** OG tags, sitemap.

#### 🚀 Launch Checklist
- [ ] DNS, SSL certificate.
- [ ] Environment variables verified production.
- [ ] Smoke test: register → unlock → start → sync → submit → results.
- [ ] Monitoring dashboards live.
- [ ] Rollback plan documented.

#### ⚠️ Rủi ro Sprint 5.2
> **R14 — Feature Creep:** Feature freeze cứng sau Tuần 16. Mọi yêu cầu mới → backlog → release 2.0.

---

## 🔑 Ma Trận Ưu Tiên Code (Priority Sequencing)

```
1. DB Schema (Prisma migrate) ✅ DONE
   → Mọi thứ khác phụ thuộc vào đây

2. Auth API + JWT Guards
   → Không có auth, không test được API nào

3. Question Content Schema (TypeScript interfaces + validation DTOs) ✅ SPEC DONE
   → Frontend và Backend phải đồng thuận trước khi code parallel
   → Xem QuestionContentSpec.md v2.1

4. Question CRUD API + PassageBundle CRUD API
   → Admin phải có dữ liệu trước khi test Exam Assembly

5. Exam Assembly API (ExamMathQuestion + ExamPassageBundle)
   → Không có đề, không có Session

6. Session Engine (Start/Sync/Submit) + Zustand Store
   → Core của toàn bộ sản phẩm

7. Question Renderers (SingleChoice, MultipleChoice, TrueFalse, DragDrop, FillNumber, PassageBundleView)
   → Có thể làm song song với Session Engine (FE/BE split)

8. Grading Worker (BullMQ) — all-or-nothing logic
   → Phụ thuộc vào Session data có trong Redis/DB

9. Result & Analytics API
   → Phụ thuộc vào Grading hoàn chỉnh

10. Proctoring, Leaderboard, IRT Analysis, Contribution UI
    → Enhancement layer, không block core flow
```

---

## 📌 Tổng Hợp Rủi Ro Kỹ Thuật

| ID | Rủi ro | Sprint | Mức độ | Giải pháp |
|----|--------|--------|--------|-----------|
| R1 | JSONB Schema Lock-in | 1.1 | ✅ Đã giải quyết | QuestionContentSpec.md v2.1 drafted & migrated |
| R2 | Rich Text Format | 1.2 | ✅ Đã quyết định | RichTextNode[] JSON (không phải Markdown string) |
| R3 | Refresh Token Security | 1.2 | 🔴 Cao | Token Rotation + Reuse Detection + DB storage |
| R4 | Admin UX Bottleneck | 2.1 | 🟡 Trung bình | Tối ưu form nhập liệu, auto-save draft |
| R5 | Access Code Race Condition | 2.2 | 🔴 Cao | Atomic DB UPDATE WHERE usedCount < maxUses |
| R6 | Double Submission | 3.1 | 🔴 Cao | Idempotency key + DB unique constraint |
| R7 | Redis Memory | 3.1 | 🟡 Trung bình | Pipeline writes + TTL 24h |
| R8 | Timer Drift | 3.1 | 🟡 Trung bình | Server-authoritative endTime |
| R9 | Grading Worker Failure | 3.2 | 🔴 Cao | Retry + Dead-letter + Alert |
| R10 | DnD Mobile | 3.2 | 🟡 Trung bình | Fallback UI |
| R11 | Large Result Payload | 4.1 | 🟢 Thấp | Lazy load + Pagination |
| R12 | IRT Accuracy | 4.2 | 🟢 Thấp | Confidence disclaimer N < 50 |
| R13 | BullMQ Queue Overflow | 5.1 | 🟡 Trung bình | Horizontal scale workers |
| R14 | Feature Creep | 5.2 | 🟡 Trung bình | Feature freeze tuần 16 |

---

## 📐 Cấu Trúc Thư Mục Hiện Tại

```
cbt-platform/
├── apps/
│   ├── api/                    # NestJS backend (port 3000)
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── questions/
│   │   │   ├── exams/
│   │   │   ├── sessions/
│   │   │   ├── analytics/
│   │   │   ├── admin/
│   │   │   ├── health/
│   │   │   └── common/         # Guards, decorators, pipes, interceptors, redis, prisma
│   │   └── prisma/
│   │       ├── schema.prisma   ← Source of truth (v2.1, 18 tables)
│   │       ├── migrations/     ← SQL history (committed)
│   │       └── seed.ts
│   └── web/                    # Vite + React 19 (port 5173)
│       ├── src/
│       │   ├── components/     # Shared UI (layouts, ui/)
│       │   ├── features/       # Feature-based modules
│       │   │   ├── auth/
│       │   │   ├── exam/
│       │   │   │   ├── renderers/   # QuestionRenderer components
│       │   │   │   ├── proctoring/  # useProctoringMonitor
│       │   │   │   └── store/       # Zustand examStore
│       │   │   ├── results/
│       │   │   └── admin/
│       │   ├── api/            # TanStack Query hooks + axios client
│       │   └── lib/            # Utilities, constants
│       ├── index.css           ← Tailwind v4 @theme design tokens (NO tailwind.config.js)
│       └── vite.config.ts
├── docs/
│   ├── execution_plan.md       ← THIS FILE
│   ├── QuestionContentSpec.md  ← Question content schema (v2.1) — CANONICAL
│   └── Sprint_1.1_Onboarding_Guide.md
├── docker-compose.yml
├── .agents/
│   └── AGENTS.md               ← Agent rules
└── .github/
    └── workflows/
        └── ci.yml
```
