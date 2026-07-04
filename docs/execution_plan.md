# 🎯 Kế Hoạch Triển Khai 5 Tháng — Nền Tảng CBT Mô Phỏng TSA HUST

> **Tech Lead Note:** Thứ tự ưu tiên tổng quát: **Infrastructure → Data Model → Core API → Core UI → Feature Layers → Hardening**. Mỗi quyết định kiến trúc ở tháng 1 sẽ quyết định tốc độ của tháng 4–5. Đừng cắt góc ở giai đoạn nền móng.

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

### Sprint 1.1 (Tuần 1–2) — Project Bootstrap & Infrastructure Core

#### Backend Deliverables
- [ ] **Project scaffolding:** Khởi tạo NestJS monorepo với cấu trúc module rõ ràng (`auth`, `users`, `questions`, `exams`, `sessions`, `analytics`, `admin`). Cài đặt Prisma, class-validator, BullMQ.
- [ ] **Docker Compose:** Stack cục bộ đầy đủ: PostgreSQL 16, Redis 7, pgAdmin, RedisInsight. File `.env.example` với mọi biến môi trường.
- [ ] **Database Schema v1 (Prisma):** Thiết kế và migrate các bảng cốt lõi:
  - `User` (id, email, passwordHash, role, createdAt)
  - `Question` (id, contentJson JSONB, metadata JSONB, irtParams JSONB, status, authorId, createdAt)
  - `Tag` + `QuestionTag` (Many-to-Many, dùng cho Content Labels)
  - `Exam` (id, title, description, durationMinutes, accessType, defaultCode)
  - `ExamQuestion` (examId, questionId, orderIndex, points)
  - `ExamAccess` (userId, examId, grantedAt, grantedByCode)
  - `AccessCode` (id, examId, code, maxUses, usedCount, expiresAt, createdByAdminId)
- [ ] **Redis Strategy Document:** Quy định rõ key namespace (VD: `session:{sessionId}:answers`, `session:{sessionId}:meta`, `leaderboard:{examId}`).
- [ ] **CI/CD Pipeline:** GitHub Actions: lint → typecheck → unit test → build. Bắt buộc pass trước khi merge.

#### Frontend Deliverables
- [ ] **Project scaffolding:** Vite + React + TypeScript. Cài đặt Tailwind CSS, Shadcn/ui, Zustand, TanStack Query, react-katex, @dnd-kit/core.
- [ ] **Design System tokens:** Định nghĩa color palette (primary, secondary, destructive, muted), typography scale, spacing, border-radius trong `tailwind.config.ts`. Tham khảo giao diện thi chuẩn (trắng/xanh dương, không gây xao nhãng).
- [ ] **Layout shell:** `RootLayout`, `AuthLayout`, `ExamLayout` (full-screen mode wrapper). Routing cơ bản bằng React Router.
- [ ] **Shared UI components:** `Button`, `Input`, `Card`, `Badge`, `Modal`, `Toast`, `Spinner`, `Skeleton`.

#### ⚠️ Rủi ro Sprint 1.1
> **R1 — Schema Lock-in:** JSONB schema cho `contentJson` phải được thiết kế đủ linh hoạt ngay từ đầu. Nếu thiếu field sau này, migration dữ liệu sẽ rất tốn kém. **Giải pháp:** Draft đầy đủ 4 loại câu hỏi (Single Choice, True/False Matrix, Drag & Drop, Fill-in-Number) vào một `QuestionContentSpec.md` trước khi code.

---

### Sprint 1.2 (Tuần 3–4) — Authentication & Question Content Model

#### Backend Deliverables
- [ ] **Auth Module (JWT + Refresh Token):**
  - `POST /auth/register` → Hash password (bcrypt, rounds=12), tạo User, tự động grant `AccessCode` mặc định cho `defaultExam`.
  - `POST /auth/login` → Trả về `accessToken` (15 phút) + `refreshToken` (7 ngày, lưu HttpOnly Cookie).
  - `POST /auth/refresh` → Rotate refresh token.
  - `POST /auth/logout` → Invalidate refresh token (blacklist trong Redis với TTL).
  - Guards: `JwtAuthGuard`, `RolesGuard` (`ADMIN`, `USER`).
- [ ] **Question Content Schema (TypeScript Interfaces + Zod/class-validator):**
  ```typescript
  // Ví dụ interface cốt lõi
  interface QuestionContent {
    stem: RichTextNode[];       // Hỗ trợ text, LaTeX, image URL
    type: 'SINGLE_CHOICE' | 'TRUE_FALSE_MATRIX' | 'DRAG_DROP' | 'FILL_NUMBER';
    payload: SingleChoicePayload | TrueFalsePayload | DragDropPayload | FillNumberPayload;
    solution?: RichTextNode[];  // Lời giải
  }
  ```
- [ ] **IRT Params Schema:**
  ```typescript
  interface IrtParams { a: number; b: number; c: number; }
  // Default: a=1, b=0, c=0.25 khi chưa có dữ liệu đủ lớn
  ```
- [ ] **Question CRUD API (Admin-only):** `POST /admin/questions`, `GET /admin/questions`, `PATCH /admin/questions/:id`, `DELETE /admin/questions/:id`. Bao gồm `status` field (`DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `ARCHIVED`).
- [ ] **File Upload:** `POST /admin/upload` → Upload ảnh lên cloud storage (S3/Cloudinary), trả về URL để nhúng vào `contentJson`.

#### Frontend Deliverables
- [ ] **Auth flows:** Trang Login, Register (form validation với React Hook Form + Zod). Zustand `authStore` lưu user info + token. TanStack Query `useAuth` hooks.
- [ ] **Protected routes:** HOC kiểm tra JWT, redirect về `/login` nếu chưa đăng nhập. Admin routes check `role`.
- [ ] **Axios interceptor:** Tự động attach Bearer token, refresh khi nhận 401.

#### ⚠️ Rủi ro Sprint 1.2
> **R2 — Rich Text & LaTeX Storage:** Quyết định format lưu trữ `stem` (plain Markdown+LaTeX string vs. structured ProseMirror JSON). **Khuyến nghị:** Dùng **Markdown string với KaTeX inline** (`$...$` và `$$...$$`) — đơn giản, dễ import, dễ render. Tránh overkill với structured JSON editor ở giai đoạn này.

> **R3 — Refresh Token Security:** Phải implement **Refresh Token Rotation** + **Reuse Detection** để phòng chống token theft. Nếu bỏ qua, đây là lỗ hổng bảo mật nghiêm trọng.

---

## 🔧 THÁNG 2 — Core Engine: Question Bank & Exam Management

> **Triết lý:** Cuối tháng 2, Admin phải có thể ngồi nhập câu hỏi và tạo ra một đề thi hoàn chỉnh. Đây là MVP nội bộ để test data flow.

### Sprint 2.1 (Tuần 5–6) — Admin Question Bank Management

#### Backend Deliverables
- [ ] **Tag / Taxonomy API:**
  - `GET /admin/tags` → Trả về cây taxonomy (Subject → Chapter → Topic → SubTopic).
  - `POST /admin/tags` → Tạo tag mới với `parentId`.
  - Endpoint tìm kiếm câu hỏi theo tag, level, type, status.
- [ ] **Question Review Workflow:** `PATCH /admin/questions/:id/status` → Admin chuyển trạng thái `PENDING_REVIEW` → `PUBLISHED`.
- [ ] **Bulk Import API (Phase 1):** `POST /admin/questions/bulk` → Nhận mảng JSON questions, validate từng item, insert theo batch. Phục vụ việc nhập tay hàng loạt từ Google Sheets.
- [ ] **Filtering & Pagination:** Tất cả list endpoints hỗ trợ `page`, `limit`, `sortBy`, `tagId[]`, `difficulty`, `type`, `status`.

#### Frontend Deliverables
- [ ] **Admin Dashboard Layout:** Sidebar navigation với các section: Questions, Exams, Users, Access Codes, Analytics.
- [ ] **Question List Page:** DataTable với filter panel (Tag tree, Type, Level, Status). Pagination. Bulk select + action (Archive, Publish).
- [ ] **Question Detail / Create Form:**
  - Markdown editor với LaTeX preview real-time (dùng `react-markdown` + `react-katex`).
  - Dynamic form: dropdown chọn `type` → render phần payload tương ứng (choices, pairs, options).
  - IRT params input với tooltip giải thích ý nghĩa.
  - Tag selector (multi-select với tree search).

#### ⚠️ Rủi ro Sprint 2.1
> **R4 — Admin UX Bottleneck:** Nếu form nhập câu hỏi phức tạp và chậm, Admin sẽ từ chối dùng → ngân hàng câu hỏi không đủ dữ liệu. **Giải pháp:** Ưu tiên tốc độ nhập liệu: keyboard shortcuts, auto-save draft, copy-paste LaTeX từ Word/Google Docs.

---

### Sprint 2.2 (Tuần 7–8) — Exam Assembly & Access Code System

#### Backend Deliverables
- [ ] **Exam Management API (Admin):**
  - `POST /admin/exams` → Tạo đề thi với metadata (title, description, duration, instructions).
  - `POST /admin/exams/:id/questions` → Thêm câu hỏi vào đề theo `orderIndex` và `points`.
  - `GET /admin/exams/:id/preview` → Preview toàn bộ đề (check đủ câu, tổng điểm, thời gian dự kiến).
  - `PATCH /admin/exams/:id/publish` → Publish đề thi (chỉ published exam mới có thể thi).
- [ ] **Access Code System:**
  - `POST /admin/access-codes` → Tạo Access Code với `examId`, `maxUses`, `expiresAt`. Sinh mã random 8 ký tự alphanumeric, uppercase.
  - `POST /exams/unlock` → User nhập code → validate → insert `ExamAccess` record → trả về exam metadata.
  - Auto-grant default exam access khi `User` được tạo (hook trong Auth service).
- [ ] **User Exam List API:** `GET /exams` → Trả về danh sách đề thi user đã được unlock (JOIN `ExamAccess`).

#### Frontend Deliverables
- [ ] **Exam Builder UI (Admin):** Drag-and-drop sắp xếp thứ tự câu hỏi (dùng @dnd-kit). Search & add questions từ question bank. Preview panel hiển thị render của từng câu.
- [ ] **Access Code Management (Admin):** Tạo, list, copy, deactivate codes. Hiển thị usage stats.
- [ ] **User Exam Library Page:** Trang `/exams` → Grid/List các đề thi đã unlock. Card hiển thị: title, duration, số câu, trạng thái (Chưa thi / Đang thi / Đã hoàn thành). Ô nhập mã để unlock đề mới.

#### ⚠️ Rủi ro Sprint 2.2
> **R5 — Access Code Race Condition:** Nếu `maxUses` được check trong application layer mà không có database lock, nhiều user cùng lúc có thể vượt quá giới hạn. **Giải pháp:** Dùng PostgreSQL `UPDATE ... WHERE usedCount < maxUses RETURNING *` trong một transaction để atomic check-and-increment.

---

## 🖥️ THÁNG 3 — Exam Experience: Session Engine & Proctoring

> **Triết lý:** Đây là tháng khó nhất và quan trọng nhất về mặt kỹ thuật. Session engine phải bulletproof. Mọi thứ phải work kể cả khi mạng không ổn định.

### Sprint 3.1 (Tuần 9–10) — Exam Session Engine & Write Path

#### Backend Deliverables
- [ ] **Session Lifecycle API:**
  - `POST /sessions` → Tạo session mới cho `(userId, examId)`. Check user có access không. Nếu có session `IN_PROGRESS` thì resume (không tạo mới). Lưu `startTime`, `endTime = startTime + duration`.
  - `GET /sessions/:id` → Trả về session metadata + danh sách câu hỏi (chỉ `id` và `type` — KHÔNG trả về đáp án đúng).
  - `GET /sessions/:id/questions/:qIndex` → Trả về nội dung câu hỏi theo index (lazy load từng câu để giảm payload khởi tạo).
  - `PATCH /sessions/:id/submit` → Nộp bài. Đặt `status = SUBMITTED`, `submittedAt = NOW()`. Đẩy grading job vào BullMQ.
- [ ] **Answer Sync API (Redis Buffer):**
  - `POST /sessions/:id/sync` → Nhận batch answers `[{questionId, answer, timeSpentMs}]`. Ghi vào Redis Hash: `HSET session:{id}:answers {questionId} {answerJson}`. Ghi time-per-question vào `HSET session:{id}:timing`. Trả về `{ok: true}` ngay lập tức (không chờ DB).
  - **Auto-flush job (BullMQ):** Worker định kỳ (mỗi 30 giây) flush Redis → PostgreSQL `SessionAnswer` table. Job này cũng chạy khi session submit.
- [ ] **Session State Recovery:** `GET /sessions/:id/state` → Lấy state hiện tại từ Redis (nếu còn) hoặc PostgreSQL (fallback). Phục vụ reload trang.

#### Frontend Deliverables
- [ ] **Zustand `examStore`:**
  ```typescript
  interface ExamStore {
    sessionId: string;
    answers: Record<string, any>;
    timing: Record<string, number>; // questionId → ms spent
    currentQuestionIndex: number;
    globalTimeRemaining: number;    // ms
    questionStartTime: number;      // Date.now() khi chuyển câu
    status: 'idle' | 'in-progress' | 'submitted';
  }
  ```
  - Persist toàn bộ store vào `localStorage` với key `exam_session_{sessionId}`.
  - Tự động rehydrate khi reload.
- [ ] **Sync Service:** `useSyncService` hook — debounce 3 giây sau mỗi lần thay đổi đáp án, batch gửi `POST /sessions/:id/sync`. Offline queue: nếu request fail, lưu vào queue và retry khi có mạng (dùng `navigator.onLine` event).
- [ ] **Timer Components:** `<GlobalCountdown/>` (tổng thời gian còn lại, đổi màu đỏ khi < 5 phút). `<QuestionTimer/>` (đếm thời gian cho câu hiện tại, hidden — chỉ ghi vào store, không hiển thị cho user).

#### ⚠️ Rủi ro Sprint 3.1
> **R6 — Double Submission:** User bấm "Nộp bài" 2 lần (do lag mạng). **Giải pháp:** Idempotency key trong request header + database unique constraint + nút submit disabled ngay sau click đầu tiên.

> **R7 — Redis Memory Pressure (Traffic Spike):** Khi 500 user cùng thi, mỗi session có ~150 keys trong Redis. Tổng = 75,000 ops khi burst. **Giải pháp:** Redis pipeline/batch để ghi nhiều field trong một lệnh `HSET`. Giới hạn TTL cho session keys (24h). Monitor memory với `INFO memory`.

> **R8 — Timer Drift:** Client-side countdown có thể lệch do tab background throttling. **Giải pháp:** Server lưu `endTime`, client so sánh `endTime - Date.now()` mỗi giây thay vì decrement thuần túy.

---

### Sprint 3.2 (Tuần 11–12) — Question Renderers & Proctoring

#### Backend Deliverables
- [ ] **Grading Worker (BullMQ):**
  - Queue: `grading-queue`. Job: `grade-session`.
  - Logic chấm điểm theo `type`:
    - `SINGLE_CHOICE`: So sánh exact match.
    - `TRUE_FALSE_MATRIX`: Điểm từng sub-item (ví dụ: 4 phát biểu, mỗi phát biểu đúng 0.25 điểm).
    - `FILL_NUMBER`: So sánh numeric với tolerance (±0.001).
    - `DRAG_DROP`: So sánh thứ tự mảng.
  - Lưu kết quả vào `ExamResult` (totalScore, maxScore, percentile, duration, completedAt).
  - Lưu chi tiết từng câu vào `SessionAnswer` (answer, isCorrect, pointsEarned, timeSpentMs).
- [ ] **Proctoring Event API:** `POST /sessions/:id/events` → Nhận `[{type: 'TAB_SWITCH' | 'FULLSCREEN_EXIT', timestamp, metadata}]`. Lưu vào `ProctoringEvent` table. **Không chặn luồng thi** — chỉ log để Admin review sau.
- [ ] **Admin Proctoring Dashboard API:** `GET /admin/sessions/:id/events` → Trả về timeline events của 1 session.

#### Frontend Deliverables
- [ ] **Question Renderer System:**
  - `<QuestionRenderer type={q.type} content={q.content} />` — Dispatcher component.
  - `<SingleChoiceQuestion/>`: Radio buttons với LaTeX support trong mỗi option.
  - `<TrueFalseMatrixQuestion/>`: Table với 4 rows (statements) × 2 cols (Đúng/Sai), radio per row.
  - `<DragDropQuestion/>`: Sử dụng `@dnd-kit/core`. Drag items từ "nguồn" vào các "slot" tương ứng. Hỗ trợ mobile touch.
  - `<FillNumberQuestion/>`: `<input type="number" step="any" />` với filter chỉ nhận ký tự số, dấu chấm, dấu trừ.
  - LaTeX rendering toàn cục với `react-katex`, wrap trong `<MathRenderer/>`.
- [ ] **Exam Interface Layout:**
  - Left panel: Question navigator (grid số câu, màu sắc: xám=chưa làm, xanh=đã làm, vàng=đánh dấu).
  - Center: Question content + Answer area.
  - Top bar: Tên đề, thời gian đếm ngược, nút "Nộp bài".
  - Bottom: Nút Previous / Next, nút "Đánh dấu xem lại".
- [ ] **Proctoring Module:**
  - `useProctoringMonitor` hook:
    - Gọi `document.documentElement.requestFullscreen()` khi bắt đầu thi.
    - Lắng nghe `visibilitychange` event → phát hiện tab switch.
    - Lắng nghe `fullscreenchange` event → phát hiện thoát full-screen.
    - Debounce 500ms, batch gửi events lên API mỗi 10 giây.
    - Hiển thị warning modal khi phát hiện vi phạm ("Bạn đã rời khỏi trang thi X lần").
- [ ] **Submit Flow:** Confirmation modal với tóm tắt (số câu đã làm / tổng, câu chưa làm). Loading state trong khi submit. Redirect sang trang kết quả sau khi hoàn tất.

#### ⚠️ Rủi ro Sprint 3.2
> **R9 — Grading Worker Failure:** Nếu grading job fail (exception), kết quả không được lưu. **Giải pháp:** BullMQ retry với exponential backoff (3 lần). Dead-letter queue để Admin can thiệp thủ công. Alert khi job fail vào Slack/email.

> **R10 — DnD Mobile Compatibility:** `@dnd-kit` có issues trên một số trình duyệt mobile. **Giải pháp:** Test kỹ trên iOS Safari và Chrome Android trong sprint này. Có fallback UI (dropdown select) nếu cần.

---

## 📊 THÁNG 4 — Analytics, Results & Access Control Polish

> **Triết lý:** Tháng này biến dữ liệu thô thành insight có giá trị — đây là yếu tố giữ chân user và tạo differentiation với các nền tảng khác.

### Sprint 4.1 (Tuần 13–14) — Result Engine & Personal Analytics

#### Backend Deliverables
- [ ] **Result API:**
  - `GET /results/:sessionId` → Trả về kết quả đầy đủ: điểm tổng, điểm từng phần (nếu có section), phân tích theo tag, thời gian làm bài, tỷ lệ đúng theo type.
  - `GET /results/:sessionId/answers` → Trả về từng câu: câu hỏi, đáp án user chọn, đáp án đúng, lời giải, `isCorrect`, `timeSpentMs`.
- [ ] **Personal Analytics API:**
  - `GET /analytics/me/exams/:examId` → Lịch sử các lần thi: điểm, thời gian, ngày thi. (Phục vụ chart progress).
  - `GET /analytics/me/weaknesses` → Tổng hợp tỷ lệ đúng theo từng tag (GROUP BY tag) → Chỉ ra điểm yếu.
  - `GET /analytics/me/time-analysis` → Thời gian trung bình / câu so với `expectedTimeSeconds` trong metadata → Chỉ ra câu nào đang bị mất quá nhiều thời gian.
- [ ] **Leaderboard API:** `GET /exams/:examId/leaderboard` → Top 100 users theo score. Dùng Redis Sorted Set (`ZADD leaderboard:{examId} score userId`) để query O(log N). Update sau mỗi grading job.

#### Frontend Deliverables
- [ ] **Result Page (`/results/:sessionId`):**
  - Hero section: Điểm số lớn, percentile rank, so sánh với lần trước.
  - Score breakdown: Pie chart theo Section/Subject.
  - Radar chart: 4 trục (Toán - Đọc hiểu - Logic - Khoa học) nếu đề có đủ sections.
  - Sử dụng `recharts` hoặc `@visx/` để vẽ biểu đồ.
- [ ] **Answer Review Page (`/results/:sessionId/review`):**
  - List tất cả câu hỏi với color coding (xanh=đúng, đỏ=sai, xám=bỏ).
  - Click vào câu để expand: xem full content, đáp án đúng, lời giải (Markdown+LaTeX), thời gian làm câu.
  - Filter: Chỉ xem câu sai / chỉ xem câu đánh dấu / chỉ xem câu bỏ.
- [ ] **Personal Analytics Dashboard:** Line chart thể hiện progression qua các lần thi. Bar chart điểm mạnh/yếu theo topic. "Điểm cần cải thiện" section với link đến câu sai tương ứng.

#### ⚠️ Rủi ro Sprint 4.1
> **R11 — Large Result Payload:** Đề 150 câu, mỗi câu có full content → response có thể > 2MB. **Giải pháp:** Lazy load câu hỏi trong review page. Chỉ load khi user click expand. Server-side pagination cho answer list.

---

### Sprint 4.2 (Tuần 15–16) — IRT Integration & Advanced Features

#### Backend Deliverables
- [ ] **IRT Analytics Service:**
  - Sau mỗi 100 submissions cho một câu, chạy background job tính lại tham số $b$ (difficulty) từ empirical data: `b_empirical = -logit(p_correct)` (ước lượng đơn giản trước khi có đủ data cho full IRT calibration).
  - `GET /admin/questions/:id/irt-stats` → Trả về: `p_correct`, `avg_time_spent`, `discrimination_index` (point-biserial), current IRT params.
  - `GET /admin/exams/:id/item-analysis` → Table phân tích từng câu trong đề: difficulty, discrimination, p_correct. Highlight các câu "bad items" (quá dễ p>0.9, quá khó p<0.1, hoặc discrimination thấp <0.2).
- [ ] **Session Time Analysis (Proctoring Backend):**
  - Aggregate `timeSpentMs` per question per session.
  - `GET /admin/sessions/:id/behavior` → Timeline: câu nào làm lâu, câu nào làm nhanh bất thường, số lần quay lại.
- [ ] **Notification System (Basic):** Email khi kết quả chấm xong (dùng `nodemailer` + queue). Email khi access code được dùng hết.

#### Frontend Deliverables
- [ ] **Leaderboard Page:** Real-time ranking (polling mỗi 30s khi đang trong giờ thi). Highlight user's own rank.
- [ ] **Admin Item Analysis Dashboard:** Sortable table với color-coded difficulty. Click vào câu → modal xem chi tiết IRT params + histogram phân phối đáp án.
- [ ] **Access Code Admin UI Polish:** Bulk generate codes, export CSV, set expiry date picker.
- [ ] **User Settings Page:** Đổi mật khẩu, xem lịch sử thi, quản lý đề đã unlock.

#### ⚠️ Rủi ro Sprint 4.2
> **R12 — IRT Calibration Accuracy:** Với số lượng user nhỏ (< 200 per exam), IRT estimates sẽ không ổn định. **Giải pháp:** Hiển thị confidence interval hoặc disclaimer "Chỉ số chưa đủ dữ liệu" khi N < 50 cho một câu. Đừng overclaim độ chính xác của IRT.

---

## 🔒 THÁNG 5 — Hardening, Security Audit & Launch

> **Triết lý:** Feature freeze sau tháng 4. Tháng 5 chỉ fix bugs, tối ưu performance và đảm bảo hệ thống survive ngày đầu launch.

### Sprint 5.1 (Tuần 17–18) — Performance & Security Hardening

#### Backend Tasks
- [ ] **Load Testing (k6 hoặc Artillery):**
  - Scenario 1 (Giờ G): 300 users đồng thời gọi `POST /sessions` trong 60 giây.
  - Scenario 2 (Sync Storm): 500 users gọi `POST /sessions/:id/sync` mỗi 5 giây trong 90 phút.
  - Scenario 3 (Nộp bài đồng loạt): 300 users gọi `PATCH /sessions/:id/submit` trong 5 giây.
  - **Target SLA:** p95 latency < 500ms. Error rate < 0.1%.
- [ ] **Database Optimization:**
  - `EXPLAIN ANALYZE` cho tất cả queries phổ biến.
  - Index: `(userId, examId)` trên `ExamSession`, `(examId, score DESC)` trên `ExamResult`.
  - Connection pooling: PgBouncer hoặc Prisma `connection_limit`.
- [ ] **Security Audit:**
  - SQL Injection: Prisma parameterized queries (đã có) → verify không có raw query nguy hiểm.
  - Rate limiting: `@nestjs/throttler` — 10 req/s cho auth endpoints, 100 req/s cho session sync.
  - CORS: Whitelist chỉ frontend domain.
  - Helmet.js: Security headers (CSP, HSTS, X-Frame-Options).
  - Input sanitization: DOMPurify ở frontend cho bất kỳ HTML rendering nào.
  - Dependency audit: `npm audit` và fix high/critical vulnerabilities.
- [ ] **Redis Sentinel / Replication:** Đảm bảo Redis không phải SPOF. Nếu dùng cloud (Upstash, Redis Cloud), check backup policy.
- [ ] **Logging & Monitoring:** Structured JSON logs với `winston` (NestJS). Integrate Sentry (error tracking). Uptime monitor (Better Uptime / UptimeRobot).

#### Frontend Tasks
- [ ] **Bundle Analysis:** `vite-bundle-visualizer` → split code, lazy-load routes, lazy-load chart libraries.
- [ ] **Core Web Vitals:** LCP < 2.5s, CLS < 0.1, FID < 100ms. Đo bằng Lighthouse CI.
- [ ] **Accessibility (a11y):** Keyboard navigation trong exam interface (đặc biệt question navigator). ARIA labels. Contrast ratio.
- [ ] **Cross-browser Testing:** Chrome, Firefox, Safari, Edge. Mobile: iOS Safari, Chrome Android.

#### ⚠️ Rủi ro Sprint 5.1
> **R13 — BullMQ Queue Overflow:** Nếu grading workers không theo kịp lượng submissions (300 jobs cùng lúc), queue sẽ đầy. **Giải pháp:** Horizontal scale workers (chạy nhiều process). Đặt `concurrency: 10` cho mỗi worker. Monitor queue depth với alert.

---

### Sprint 5.2 (Tuần 19–20) — Final Polish, UAT & Launch

#### Backend Tasks
- [ ] **API Documentation:** Swagger/OpenAPI tự động từ NestJS decorators. Publish tại `/api/docs` (protected bằng basic auth).
- [ ] **Database Backup:** Automated daily backup PostgreSQL → S3. Test restore procedure.
- [ ] **Graceful Shutdown:** NestJS `enableShutdownHooks()` + BullMQ `worker.close()` để không mất jobs khi deploy.
- [ ] **Health Check Endpoint:** `GET /health` → Check DB connection, Redis ping, queue status. Dùng `@nestjs/terminus`.
- [ ] **Environment Promotion:** Staging environment với production-like data. Run smoke tests.

#### Frontend Tasks
- [ ] **User Acceptance Testing (UAT):** Mời 10–20 học sinh thật dùng thử. Thu thập feedback về UX, độ mượt của giao diện thi, tốc độ.
- [ ] **Onboarding Flow:** Tutorial overlay lần đầu vào trang thi (giải thích các nút, cách đánh dấu câu, cách nộp bài).
- [ ] **Empty States & Error States:** Thiết kế đầy đủ: không có đề nào, lỗi mạng, session hết hạn, server error 500.
- [ ] **SEO & Meta:** OG tags cho trang chủ và trang giới thiệu. Sitemap cho các trang public.
- [ ] **PWA (Optional stretch goal):** Service Worker để cache static assets → tải nhanh hơn trên mạng chậm.

#### 🚀 Launch Checklist
- [ ] DNS, SSL certificate (Let's Encrypt hoặc cloud provider).
- [ ] Environment variables verified trên production.
- [ ] Smoke test tất cả critical paths (register → unlock exam → start session → sync answers → submit → view results).
- [ ] Monitoring dashboards live.
- [ ] Rollback plan documented.
- [ ] On-call contact list.

#### ⚠️ Rủi ro Sprint 5.2
> **R14 — Last-minute Feature Creep:** Team sẽ có urge thêm feature mới vào phút cuối. **Giải pháp:** Feature freeze cứng sau Tuần 16. Mọi yêu cầu mới vào backlog → release 2.0.

---

## 🔑 Ma Trận Ưu Tiên Code (Priority Sequencing)

Thứ tự này đảm bảo không bị "block" tiến độ do dependency chưa sẵn sàng:

```
1. DB Schema (Prisma migrate) 
   → Mọi thứ khác phụ thuộc vào đây
   
2. Auth API + JWT Guards 
   → Không có auth, không test được API nào

3. Question Content Schema (TypeScript interfaces) 
   → Frontend và Backend phải đồng thuận trước khi code parallel

4. Question CRUD API 
   → Admin phải có dữ liệu trước khi test Exam Assembly

5. Exam Assembly API 
   → Không có đề, không có Session

6. Session Engine (Start/Sync/Submit) + Zustand Store 
   → Core của toàn bộ sản phẩm

7. Question Renderers 
   → Có thể làm song song với Session Engine (FE/BE split)

8. Grading Worker 
   → Phụ thuộc vào Session data có trong Redis/DB

9. Result & Analytics API 
   → Phụ thuộc vào Grading hoàn chỉnh

10. Proctoring, Leaderboard, IRT Analysis 
    → Enhancement layer, không block core flow
```

---

## 📌 Tổng Hợp Rủi Ro Kỹ Thuật

| ID | Rủi ro | Sprint | Mức độ | Giải pháp |
|----|--------|--------|--------|-----------|
| R1 | JSONB Schema Lock-in | 1.1 | 🔴 Cao | Draft `QuestionContentSpec.md` trước khi code |
| R2 | Rich Text Format | 1.2 | 🟡 Trung bình | Chọn Markdown+KaTeX string |
| R3 | Refresh Token Security | 1.2 | 🔴 Cao | Token Rotation + Reuse Detection |
| R4 | Admin UX Bottleneck | 2.1 | 🟡 Trung bình | Tối ưu form nhập liệu |
| R5 | Access Code Race Condition | 2.2 | 🔴 Cao | Atomic DB update |
| R6 | Double Submission | 3.1 | 🔴 Cao | Idempotency key + DB constraint |
| R7 | Redis Memory Pressure | 3.1 | 🟡 Trung bình | Pipeline writes + TTL |
| R8 | Timer Drift | 3.1 | 🟡 Trung bình | Server-authoritative `endTime` |
| R9 | Grading Worker Failure | 3.2 | 🔴 Cao | Retry + Dead-letter queue + Alert |
| R10 | DnD Mobile Issues | 3.2 | 🟡 Trung bình | Fallback UI |
| R11 | Large Result Payload | 4.1 | 🟢 Thấp | Lazy load + Pagination |
| R12 | IRT Accuracy | 4.2 | 🟢 Thấp | Confidence disclaimer |
| R13 | BullMQ Queue Overflow | 5.1 | 🟡 Trung bình | Horizontal scale workers |
| R14 | Feature Creep | 5.2 | 🟡 Trung bình | Feature freeze tuần 16 |

---

## 📐 Gợi Ý Cấu Trúc Thư Mục

```
project/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── questions/
│   │   │   ├── exams/
│   │   │   ├── sessions/
│   │   │   ├── analytics/
│   │   │   ├── admin/
│   │   │   └── common/         # Guards, decorators, pipes, interceptors
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── migrations/
│   └── web/                    # Vite + React frontend
│       ├── src/
│       │   ├── components/     # Shared UI
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
│       └── public/
├── docker-compose.yml
├── docker-compose.prod.yml
└── .github/
    └── workflows/
        └── ci.yml
```
