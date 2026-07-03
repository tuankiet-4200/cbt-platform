# Hướng Dẫn Chi Tiết Triển Khai Sprint 1.1 (Onboarding Guide)

> **Dành cho:** Kỹ sư mới gia nhập dự án  
> **Người viết:** Senior Tech Lead / Technical Project Manager  
> **Dự án:** CBT Platform — TSA HUST Simulation

Tài liệu này hướng dẫn chi tiết từng bước tái lập lại toàn bộ môi trường và cấu trúc của **Sprint 1.1 (Project Bootstrap & Infrastructure Core)**. Bạn sẽ hiểu không chỉ *cách làm* mà còn *tại sao* chúng ta lại đưa ra các quyết định kiến trúc này.

---

## 🧭 Kiến Trúc Tổng Quan (Monorepo)

Chúng ta chọn cấu trúc **NPM Workspaces Monorepo** để quản lý cả hai phần Frontend (SPA) và Backend (API Server) trong cùng một repository. 

### Tại sao chọn Monorepo?
1. **Single Source of Truth:** Dễ dàng chia sẻ kiểu dữ liệu (Types/Interfaces) giữa Frontend và Backend sau này.
2. **Atomic Commits:** Thay đổi logic cơ sở dữ liệu và giao diện có thể đi kèm trong một Commit duy nhất.
3. **CI/CD Đơn Giản:** Một pipeline duy nhất quản lý kiểm tra chất lượng code của toàn bộ dự án.

---

## 🛠️ BƯỚC 1: Khởi Tạo Monorepo Gốc (Root Workspace)

Tạo thư mục dự án và thiết lập workspaces.

### 1. Tạo file `package.json` ở thư mục gốc
Tại thư mục gốc `cbt-platform/`, tạo file `package.json` để khai báo các workspace con nằm trong `apps/`:

```json
{
  "name": "cbt-platform",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev -w apps/api\" \"npm run dev -w apps/web\"",
    "dev:api": "npm run dev -w apps/api",
    "dev:web": "npm run dev -w apps/web",
    "build": "npm run build -w apps/api && npm run build -w apps/web",
    "lint": "npm run lint -w apps/api && npm run lint -w apps/web",
    "typecheck": "npm run typecheck -w apps/api && npm run typecheck -w apps/web",
    "db:migrate": "npm run prisma:migrate -w apps/api",
    "db:seed": "npm run prisma:seed -w apps/api"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

* **Giải thích:** Lệnh `npm run dev` sử dụng `concurrently` giúp chạy đồng thời cả API Server (NestJS) và Web App (Vite React) bằng 1 câu lệnh duy nhất từ thư mục gốc.

### 2. Thiết lập `.gitignore`
Tránh commit các thư mục runtime, log, build artifact, và đặc biệt là file `.env` chứa mật khẩu bí mật:

```gitignore
node_modules/
dist/
.nest/
coverage/
.env
.env.local
.DS_Store
```

---

## 🐳 BƯỚC 2: Thiết Lập Infrastructure Qua Docker Compose

Hệ thống của chúng ta đòi hỏi PostgreSQL làm Primary DB và Redis làm In-memory database phục vụ đồng bộ đáp án thực tế và Message Broker (BullMQ).

### 1. Tạo file `docker-compose.yml` tại root:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: cbt_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-cbt_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-cbt_password_dev}
      POSTGRES_DB: ${POSTGRES_DB:-cbt_platform}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cbt_user -d cbt_platform"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: cbt_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

### 2. Tạo SQL script khởi tạo database
Tạo file `docker/postgres/init.sql`:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
```
* **Giải thích:** 
  * `uuid-ossp`: Để sinh UUID ngẫu nhiên ngay trong DB.
  * `pg_trgm` & `btree_gin`: Tạo tiền đề để thiết lập chỉ mục **GIN Index** cho cột câu hỏi `JSONB` sau này, giúp tìm kiếm và truy vấn các thuộc tính bên trong JSON đạt hiệu năng cao khi traffic spike.

---

## 🗄️ BƯỚC 3: Thiết Lập Cơ Sở Dữ Liệu Với Prisma (Backend Schema)

Chúng ta sử dụng **Prisma ORM** để quản lý cơ sở dữ liệu PostgreSQL.

### 1. Thiết kế Prisma Schema (`apps/api/prisma/schema.prisma`)
Các bảng cốt lõi cần được định nghĩa chính xác về kiểu dữ liệu và chỉ mục:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearchPostgres"]
}

enum UserRole {
  ADMIN
  USER
}

enum QuestionType {
  SINGLE_CHOICE
  TRUE_FALSE_MATRIX
  DRAG_DROP
  FILL_NUMBER
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String   @map("password_hash")
  displayName  String   @map("display_name")
  role         UserRole @default(USER)
  createdAt    DateTime @default(now()) @map("created_at")
  
  sessions     ExamSession[]
  @@map("users")
}

model Question {
  id           String       @id @default(uuid())
  type         QuestionType
  contentJson  Json         @map("content_json") @db.JsonB
  irtParams    Json         @map("irt_params") @db.JsonB
  
  @@map("questions")
}

model Exam {
  id           String       @id @default(uuid())
  title        String
  durationMins Int          @map("duration_mins")
  isPublished  Boolean      @default(false) @map("is_published")

  @@map("exams")
}

model ExamSession {
  id          String        @id @default(uuid())
  userId      String        @map("user_id")
  examId      String        @map("exam_id")
  status      String        @default("IN_PROGRESS")
  startTime   DateTime      @default(now()) @map("start_time")
  endTime     DateTime      @map("end_time")

  user        User          @relation(fields: [userId], references: [id])
  exam        Exam          @relation(fields: [examId], references: [id])
  @@map("exam_sessions")
}
```

* **Quyết định thiết kế cốt lõi (JSONB):** Chúng ta lưu trữ dữ liệu câu hỏi trong cột `content_json` dạng `JSONB`. Do đề thi TSA có nhiều dạng bài phức tạp như Matrix Đúng/Sai hay Kéo Thả, việc dùng cột JSONB giúp tránh việc tạo quá nhiều bảng con gây chậm tốc độ JOIN cơ sở dữ liệu.

### 2. Thiết lập Seed Data (`apps/api/prisma/seed.ts`)
Tạo dữ liệu mẫu (Admin Account, Đề thi mặc định, Câu hỏi mẫu) để môi trường dev của các thành viên trong nhóm luôn có sẵn dữ liệu chuẩn để chạy thử ngay sau khi pull code.

---

## ⚡ BƯỚC 4: Khởi Tạo NestJS API Server (Backend)

Cơ cấu NestJS được tổ chức theo tính module hóa rõ rệt.

### 1. Khởi tạo Bootstrap API (`apps/api/src/main.ts`)
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.use(compression());
  app.enableCors();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.listen(3000);
}
bootstrap();
```
* **Giải thích:**
  * `helmet()`: Đảm bảo các HTTP Header bảo mật cơ bản được thêm vào API.
  * `compression()`: Nén dữ liệu gzip gửi đi để tối ưu băng thông khi tải câu hỏi lớn.
  * `ValidationPipe`: Tự động validate input payload sử dụng decorators (`class-validator`) giúp ngăn chặn dữ liệu xấu vào hệ thống.

### 2. Tạo Core Services (Prisma & Redis)
Tạo `PrismaService` kế thừa từ `PrismaClient` và `RedisService` wrap client `ioredis`. 
* Hai service này được gắn nhãn `@Global()` tại module của chúng nhằm đảm bảo mọi module nghiệp vụ khác như `auth`, `sessions` đều có thể import và sử dụng trực tiếp mà không cần khai báo lại.

---

## 🎨 BƯỚC 5: Thiết Lập React SPA (Frontend + Tailwind v4)

Chúng ta sử dụng **Vite + React 19 + Tailwind v4**.

### 1. Kiến trúc Tailwind v4 (CSS-First)
Trong Tailwind v4, file cấu hình JS truyền thống `tailwind.config.js` đã bị loại bỏ. Toàn bộ thiết lập theme được định nghĩa bằng CSS Custom Properties bên trong `@theme` ở file `apps/web/src/index.css`:

```css
@import "tailwindcss";

@theme {
  --color-primary-500: #3b82f6;
  --color-q-answered: #3b82f6;
  --color-q-flagged: #f59e0b;
  
  --font-sans: Inter, sans-serif;
}

@layer components {
  .card {
    background-color: white;
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-neutral-200);
  }
}
```

* **Lợi ích:** Trực quan hơn, tận dụng tối đa chuẩn CSS gốc và cho phép compile thẳng qua plugin Vite cực kỳ nhanh.

### 2. Tích hợp Vite Plugin cho Tailwind v4
Cập nhật file `apps/web/vite.config.ts` để sử dụng `@tailwindcss/vite`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 3. Thiết lập API Client (Axios + Refresh Token Interceptor)
Tạo `api-client.ts` để:
* Tự động đính kèm `Authorization: Bearer <token>` vào mọi API request.
* Lắng nghe mã lỗi `401 Unauthorized` từ Backend để tự động gọi API `/auth/refresh` bằng cookie HTTPS, lấy access token mới và retry lại các request bị lỗi trước đó mà người dùng không hề hay biết (Silent Refresh).

---

## 🧪 BƯỚC 6: Kiểm Tra và Vận Hành Hệ Thống

Để đảm bảo code của bạn chạy đúng chuẩn và không làm hỏng build của người khác:

### 1. Khởi động môi trường Database & Redis
```bash
npm run docker:up
```

### 2. Chạy Migrations và Seed Dữ Liệu
```bash
npm run db:migrate
npm run db:seed
```

### 3. Kiểm tra kiểu dữ liệu (Typecheck) toàn diện
Đảm bảo TypeScript không có bất kỳ lỗi biên dịch nào:
```bash
npm run typecheck
```

### 4. Chạy hệ thống local dev
```bash
npm run dev
```
Truy cập:
* Frontend: `http://localhost:5173`
* Backend API Swagger Docs: `http://localhost:3000/api/docs`

---

## 📌 Các File Tài Liệu Thiết Kế Cốt Lõi Cần Đọc

Để phục vụ phát triển các Sprint tiếp theo, hãy đọc kỹ 2 tài liệu thiết kế sau đã được cấu trúc sẵn trong dự án:
1. **[`docs/QuestionContentSpec.md`](file:///Users/kietnt/Documents/dev/cbt-platform/docs/QuestionContentSpec.md):** Định nghĩa cấu trúc JSON của 4 dạng câu hỏi (Single Choice, Matrix Đúng/Sai, Kéo thả, Điền số) và cấu trúc chấm điểm.
2. **[`docs/RedisKeyStrategy.md`](file:///Users/kietnt/Documents/dev/cbt-platform/docs/RedisKeyStrategy.md):** Chiến lược lưu trữ cache đáp án tạm thời, time-spent tracking của thí sinh và cách tối ưu hóa ghi bất đồng bộ (Write Path Buffer) trong Redis.
