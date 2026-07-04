# Hướng Dẫn Chi Tiết Khởi Tạo Dự Án Từ Đầu (Sprint 1.1 Onboarding Guide)

> **Dành cho:** Kỹ sư mới gia nhập dự án  
> **Người viết:** Senior Tech Lead / Technical Project Manager  
> **Dự án:** CBT Platform — TSA HUST Simulation
> **Cập nhật cuối:** Sau đợt Schema Revamp & Contribution System (Sprint 1.1 complete)

Tài liệu này hướng dẫn chi tiết toàn bộ các câu lệnh terminal và thao tác cấu hình để thiết lập dự án **từ một thư mục hoàn toàn trống rỗng**. 

Khác với cách tiếp cận thông thường là tạo file cấu hình monorepo trước, hướng dẫn này tuân theo quy trình chuẩn trong thực tế phát triển: **Khởi tạo các ứng dụng độc lập bằng CLI của từng framework trước (để chúng tự tạo ra file `package.json` và cấu hình riêng), sau đó mới bọc monorepo ở ngoài để quản lý tập trung.**

---

## 🧭 Kiến Trúc Tổng Quan (Monorepo)

Chúng ta chọn cấu trúc **NPM Workspaces Monorepo** để quản lý cả hai phần Frontend (SPA) và Backend (API Server) trong cùng một repository. 

```
cbt-platform/                  ← Thư mục gốc monorepo (quản lý chung)
├── package.json               ← Định nghĩa workspaces & lệnh chạy đồng thời
├── apps/                      ← Thư mục chứa các ứng dụng con
│   ├── api/                   ← NestJS Backend (tự trị, port 3000)
│   │   ├── package.json       ← Thư viện riêng của API & Prisma
│   │   └── prisma/            ← Database migrations & schema
│   └── web/                   ← React Vite Frontend (tự trị, port 5173)
│       └── package.json       ← Thư viện riêng của UI
```

---

## 🛠️ BƯỚC 1: Khởi Tạo Các Dự Án Con (Cài Framework Trước)

Bắt đầu với một thư mục trống rỗng trên máy của bạn.

### 1. Tạo cấu trúc thư mục cơ sở
Mở terminal và chạy:
```bash
# Tạo thư mục gốc dự án
mkdir cbt-platform
cd cbt-platform

# Khởi tạo Git repository
git init

# Tạo thư mục chứa các app con
mkdir apps
cd apps
```

### 2. Dựng khung dự án NestJS API Server (Backend)
Tại thư mục `apps/`, sử dụng Nest CLI để sinh cấu trúc backend `api`:
```bash
# Sử dụng npx để chạy trực tiếp Nest CLI không cần cài global
npx -y @nestjs/cli new api --package-manager npm --strict
```
*(CLI sẽ tự động sinh thư mục `apps/api/` kèm file `apps/api/package.json` chuẩn của NestJS với TypeScript strict mode).*

### 3. Dựng khung dự án React Vite (Frontend)
Tại thư mục `apps/`, sử dụng trình khởi tạo của Vite để sinh dự án `web`:
```bash
# Dựng khung React + TypeScript bằng Vite
npx -y create-vite web --template react-ts
```
*(Vite sẽ tạo thư mục `apps/web/` kèm file `apps/web/package.json` gọn nhẹ và cấu hình build).*

---

## 📦 BƯỚC 2: Cài Đặt Thư Viện Riêng Cho Từng App Con

Bây giờ mỗi app con đã có `package.json` độc lập. Ta tiến hành vào từng thư mục để cài các thư viện nghiệp vụ riêng.

### 1. Cài đặt dependencies cho Backend (API)
Di chuyển vào `apps/api/` để cài đặt:
```bash
cd api

# Cài đặt Prisma ORM làm Dev Dependency
npm install prisma --save-dev

# Cài đặt các thư viện lõi cho API, Auth, Queue, và Validation
npm install @prisma/client @nestjs/config @nestjs/jwt @nestjs/passport @nestjs/swagger @nestjs/terminus @nestjs/throttler @nestjs/schedule ioredis bullmq bcrypt passport passport-jwt passport-local class-validator class-transformer helmet compression

# Cài đặt types cho TypeScript dev
npm install @types/bcrypt @types/passport-jwt @types/passport-local @types/compression --save-dev

# Quay lại thư mục apps/
cd ..
```

### 2. Cài đặt dependencies cho Frontend (Web)
Di chuyển vào `apps/web/` để cài đặt:
```bash
cd web

# Cài đặt Tailwind CSS v4 và Vite plugin hỗ trợ v4
npm install tailwindcss@4.1.11 @tailwindcss/vite@4.1.11

# Cài đặt các thư viện UI, Quản lý State, Biểu đồ, LaTeX rendering và DnD
npm install zustand @tanstack/react-query @tanstack/react-query-devtools axios react-router-dom lucide-react clsx tailwind-merge class-variance-authority react-hook-form @hookform/resolvers zod recharts react-katex katex @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-markdown remark-math rehype-katex

# Cài đặt types cho LaTeX
npm install @types/katex --save-dev

# Cài đặt Radix UI Primitives làm nền tảng cho Shadcn components
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-toast @radix-ui/react-tooltip @radix-ui/react-progress @radix-ui/react-separator @radix-ui/react-avatar @radix-ui/react-switch
```

---

## 🔗 BƯỚC 3: Bọc Monorepo & Liên Kết Workspaces Tại Root

Sau khi các ứng dụng con đã có đầy đủ khung và cấu hình thư viện, chúng ta quay ra thư mục gốc để liên kết chúng lại thành một Monorepo thống nhất.

### 1. Khởi tạo package.json gốc
Quay lại thư mục gốc `cbt-platform/`:
```bash
cd ../..
# Tạo file package.json gốc
npm init -y
```

### 2. Cấu hình workspaces và scripts chạy đồng thời
Mở file `package.json` vừa tạo ở thư mục gốc và sửa đổi toàn bộ nội dung thành:
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
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "docker:logs": "docker compose logs -f",
    "db:migrate": "npm run prisma:migrate -w apps/api",
    "db:seed": "npm run prisma:seed -w apps/api"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

### 3. Cơ chế hoạt động của NPM Workspaces (Hoisting & Symlinking)
Bây giờ, tại thư mục gốc, hãy chạy lệnh:
```bash
npm install
```

**Điều gì xảy ra sau lệnh này?**
1. **Dependency Hoisting:** npm sẽ quét toàn bộ file `package.json` ở gốc và các thư mục con trong `apps/*`. Nó sẽ nhấc (hoist) toàn bộ các thư viện trùng lặp lên thư mục `node_modules/` ở thư mục gốc để tránh việc tải xuống nhiều lần và tiết kiệm dung lượng ổ đĩa.
2. **Workspace Symlinking:** npm tự động tạo ra các symlinks (đường dẫn tắt) bên trong `node_modules` ở gốc trỏ tới `apps/api` và `apps/web`. Điều này giúp các app con có thể import qua lại lẫn nhau dễ dàng như một thư viện npm thông thường.

### 4. Thiết lập `.gitignore` gốc
Tạo file `.gitignore` ở thư mục gốc:
```gitignore
node_modules/
dist/
.nest/
coverage/
.env
.env.local
.DS_Store
*.log
```

---

## 🐳 BƯỚC 4: Thiết Lập Infrastructure Qua Docker Compose

Hệ thống của chúng ta đòi hỏi PostgreSQL làm cơ sở dữ liệu chính và Redis làm In-memory database phục vụ đồng bộ đáp án tức thời (Redis write buffer) và hàng đợi chấm điểm (BullMQ).

### 1. Tạo file `docker-compose.yml` tại thư mục gốc:
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

### 2. Tạo SQL script khởi tạo database mở rộng
Tạo file `docker/postgres/init.sql`:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
```
* **Giải thích:** 
  * `uuid-ossp`: Để sinh UUID ngẫu nhiên ngay trong DB.
  * `pg_trgm` & `btree_gin`: Cần thiết để sau này lập chỉ mục **GIN Index** cho cột câu hỏi `JSONB` (`content_json`), giúp tìm kiếm full-text search và truy vấn các thuộc tính bên trong JSON đạt hiệu năng cao khi hàng ngàn thí sinh cùng làm bài.

Khởi động các dịch vụ lên:
```bash
npm run docker:up
```

---

## 🗄️ BƯỚC 5: Thiết Lập Database Schema & Migrations (Prisma)

Sau khi có Postgres, ta cấu hình cơ sở dữ liệu cho NestJS.

### 1. Khởi tạo Prisma trong ứng dụng Backend
Di chuyển vào `apps/api/` và chạy lệnh init:
```bash
cd apps/api
npx prisma init
```
*(Lệnh này sinh ra file `apps/api/prisma/schema.prisma` và file `.env` chứa URL kết nối).*

### 2. Cập nhật cấu hình Schema (`apps/api/prisma/schema.prisma`)
Copy và định nghĩa schema chuẩn của dự án (với các models nguyên khối mới `PassageBundle`, `ExamMathQuestion` v.v. đã thống nhất ở Sprint 1.1):
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
  MULTIPLE_CHOICE
  TRUE_FALSE_MATRIX
  DRAG_DROP
  FILL_NUMBER
}

enum ExamSectionType {
  MATH
  READING
  SCIENCE
}

model User {
  id                String         @id @default(uuid())
  email             String         @unique
  passwordHash      String         @map("password_hash")
  displayName       String         @map("display_name")
  role              UserRole       @default(USER)
  createdAt         DateTime       @default(now()) @map("created_at")
  updatedAt         DateTime       @updatedAt @map("updated_at")

  refreshTokens     RefreshToken[]
  examAccesses      ExamAccess[]
  sessions          ExamSession[]
  authoredQuestions Question[]     @relation("QuestionAuthor")
  
  @@map("users")
}

// (Xem schema.prisma đầy đủ trong source code để biết chi tiết các model khác)
```

### 3. Tạo migration đầu tiên và đồng bộ database
Định nghĩa biến môi trường `DATABASE_URL` trong file `apps/api/.env`:
```env
DATABASE_URL="postgresql://cbt_user:cbt_password_dev@localhost:5432/cbt_platform?schema=public"
```

Chạy lệnh tạo migration tại thư mục gốc monorepo:
```bash
# Quay lại thư mục gốc dự án
cd ../..

# Tạo và áp dụng migration
npx prisma migrate dev --name "init_schema" --schema=apps/api/prisma/schema.prisma
```
*(Lệnh này sẽ tạo thư mục `apps/api/prisma/migrations/`, chạy file SQL lên Postgres và sinh ra Prisma Client types nằm trong `node_modules/@prisma/client` để code backend import sử dụng).*

---

## ⚡ BƯỚC 6: Cấu Hình NestJS API Server (Backend)

Cấu trúc code backend được tổ chức theo module hóa.

### 1. Khởi tạo entry point (`apps/api/src/main.ts`)
Tích hợp các middleware bảo mật, nén dữ liệu và validation toàn cục:
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(compression());
  app.enableCors({ origin: 'http://localhost:5173', credentials: true });
  
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  await app.listen(3000);
}
bootstrap();
```

### 2. Đăng ký Prisma & Redis Service làm Global Services
Chúng ta tạo ra module `PrismaModule` chứa `PrismaService` (kế thừa `PrismaClient`) và `RedisModule` chứa `RedisService` (wrap client `ioredis`). Gắn decorator `@Global()` ở đầu module để các module nghiệp vụ như `AuthModule` hay `SessionModule` có thể sử dụng trực tiếp mà không cần import lại nhiều lần.

---

## 🎨 BƯỚC 7: Cấu Hình React SPA (Frontend + Tailwind v4)

Chúng ta sử dụng **Vite + React 19 + Tailwind v4**.

### 1. Tận dụng kiến trúc CSS-First của Tailwind v4
Tailwind v4 loại bỏ file cấu hình JS `tailwind.config.js`. Toàn bộ cấu hình hệ thống theme được lưu trong file `apps/web/src/index.css` sử dụng `@theme` directive:
```css
@import "tailwindcss";

@theme {
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  --color-accent-500: #6366f1;

  --font-sans: Inter, system-ui, sans-serif;
}

@layer components {
  .card {
    background-color: white;
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-neutral-200);
    box-shadow: var(--shadow-card);
  }
  
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
    font-weight: 500;
    transition: all 0.15s;
  }
}
```

### 2. Cấu hình Vite (`apps/web/vite.config.ts`)
Tích hợp plugin `@tailwindcss/vite` vào build pipeline của Vite và cấu hình proxy chuyển tiếp các cuộc gọi từ `/api` về API server NestJS ở port 3000 khi phát triển cục bộ để tránh lỗi CORS:
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
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

---

## 🧪 BƯỚC 8: Vận Hành & Kiểm Tra

Sau khi thiết lập xong các bước trên, bạn chạy kiểm thử để đảm bảo mọi thứ trơn tru:

1. **Khởi chạy môi trường Dev:**
   ```bash
   npm run dev
   ```
   *Lệnh này sẽ khởi động song song NestJS API (port 3000) và Vite (port 5173) nhờ package `concurrently` cấu hình tại root.*

2. **Kiểm tra biên dịch:**
   ```bash
   npm run typecheck
   ```
   *Đảm bảo cả dự án Frontend và Backend không có bất kỳ lỗi TypeScript nào.*

3. **Truy cập:**
   - Client App: `http://localhost:5173`
   - API Endpoint: `http://localhost:3000/api/v1`

---

## 📌 Các Tài Liệu Cốt Lõi Cần Tham Khảo

Để viết tiếp code tính năng, bạn **bắt buộc** phải đọc kỹ các tài liệu đặc tả sau:
1. **[`docs/QuestionContentSpec.md`](file:///Users/kietnt/Documents/dev/cbt-platform/docs/QuestionContentSpec.md):** Đặc tả định dạng JSON của 5 loại câu hỏi và logic chấm điểm All-or-Nothing.
2. **[`docs/PROJECT_CONTEXT.md`](file:///Users/kietnt/Documents/dev/cbt-platform/docs/PROJECT_CONTEXT.md):** Tài liệu lưu trữ trạng thái hiện tại của dự án để nắm bắt những gì đã làm và những gì cần làm tiếp theo.
3. **[`.agents/AGENTS.md`](file:///Users/kietnt/Documents/dev/cbt-platform/.agents/AGENTS.md):** Quy chuẩn phát triển code (Prisma migration pipeline, Git commit conventions).
