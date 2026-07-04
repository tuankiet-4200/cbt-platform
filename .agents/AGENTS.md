# CBT Platform — Agent Rules

Đây là tập hợp các quy tắc bắt buộc khi làm việc với project **cbt-platform**.
Agent phải tuân thủ toàn bộ các quy tắc này trước khi kết thúc mỗi task.

---

## 1. Prisma Schema — Quy tắc sau khi sửa `schema.prisma`

**Mỗi khi có bất kỳ thay đổi nào trong `apps/api/prisma/schema.prisma`**, agent PHẢI thực hiện đủ 3 bước sau, theo thứ tự:

### Bước 1 — Validate schema
```bash
npx prisma validate --schema=apps/api/prisma/schema.prisma
```
Nếu validate fail → sửa lỗi trước, không được tiếp tục.

### Bước 2 — Tạo và apply migration (môi trường dev)
```bash
npx prisma migrate dev --name <ten_mo_ta_ngan> --schema=apps/api/prisma/schema.prisma
```
- `--name` phải mô tả đúng nội dung thay đổi, viết thường, dùng dấu `_` (ví dụ: `add_contribution_model`, `fix_exam_question_split`)
- Lệnh này tự động chạy `prisma generate` ở cuối → **không cần chạy generate riêng**
- Nếu DB báo "drift detected" trên môi trường dev → chạy `npx prisma migrate reset --force` trước

### Bước 3 — Commit file migration cùng schema
```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "chore(db): <mo_ta_migration>"
```
File migration SQL **bắt buộc phải được commit** cùng với schema. Không commit schema mà thiếu migration.

### Tham chiếu nhanh

| Tình huống | Lệnh |
|-----------|------|
| Dev — sửa schema, apply lên DB | `prisma migrate dev --name ten` |
| Dev — DB bị drift, reset sạch | `prisma migrate reset --force` |
| Production — apply migration đã có | `prisma migrate deploy` |
| Chỉ update TypeScript types (không đụng DB) | `prisma generate` |
| Kiểm tra trạng thái migration | `prisma migrate status` |

> ⚠️ **Không bao giờ** dùng `prisma db push` trên project này. Chỉ dùng migration workflow.

---

## 2. Docker — Kiểm tra trước khi migrate

Trước khi chạy migrate, kiểm tra PostgreSQL container đang chạy:
```bash
docker compose ps
```
Nếu `cbt_postgres` chưa chạy:
```bash
docker compose up -d postgres redis
sleep 3   # chờ Postgres ready
```

---

## 3. Monorepo — Workspace Commands

Project dùng npm workspaces. Luôn chạy lệnh từ **root** (`/Users/kietnt/Documents/dev/cbt-platform`):

```bash
# Chạy lệnh cho 1 workspace cụ thể
npm run <script> -w apps/api
npm run <script> -w apps/web

# Build tất cả
npm run build

# Dev server
npm run dev -w apps/api    # NestJS backend (port 3000)
npm run dev -w apps/web    # Vite frontend (port 5173)
```

---

## 4. Commit Convention

Mọi commit phải theo format **Conventional Commits**:

```
<type>(<scope>): <mô tả ngắn>

Types: feat | fix | chore | refactor | docs | test | ci
Scopes: schema | api | web | db | auth | exam | session | infra
```

Ví dụ:
- `feat(schema): add PassageBundle model for reading section`
- `chore(db): migration for ContributionSubmission table`
- `fix(api): correct grading logic for FILL_NUMBER multi-blank`

---

## 5. Kiểm tra cuối task

Trước khi báo task hoàn thành, agent phải tự kiểm tra checklist sau:

- [ ] `prisma validate` passed không?
- [ ] Nếu sửa schema → đã có migration mới trong `apps/api/prisma/migrations/`?
- [ ] Migration file đã được `git add` và commit?
- [ ] `prisma generate` đã chạy (hoặc được chạy tự động bởi `migrate dev`)?
- [ ] `npm run build` hoặc `npm run typecheck` vẫn pass sau thay đổi?
- [ ] Không có file thừa bị emit ra ngoài (ví dụ `vite.config.js` từ `tsc`)
