# CBT Platform — TSA HUST Simulation

## Tech Stack
- **Frontend:** React (Vite) + TypeScript + Tailwind CSS + Shadcn/ui + Zustand + TanStack Query
- **Backend:** NestJS + TypeScript + Prisma + BullMQ
- **Database:** PostgreSQL 16
- **Cache/Queue:** Redis 7 + BullMQ

## Getting Started

### Prerequisites
- Node.js >= 20.0.0
- Docker & Docker Compose
- npm >= 10.0.0

### 1. Clone & Install
```bash
git clone <repo-url>
cd cbt-platform
cp .env.example .env
npm install
```

### 2. Start Infrastructure
```bash
npm run docker:up
```
Services:
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- pgAdmin: `http://localhost:5050`
- RedisInsight: `http://localhost:8001`

### 3. Database Setup
```bash
npm run db:migrate
npm run db:seed   # Optional: seed sample data
```

### 4. Start Development
```bash
npm run dev       # Start both API and Web
npm run dev:api   # API only (port 3000)
npm run dev:web   # Web only (port 5173)
```

## Project Structure
```
cbt-platform/
├── apps/
│   ├── api/            # NestJS backend
│   └── web/            # React (Vite) frontend
├── packages/
│   └── shared-types/   # Shared TypeScript types (FE + BE)
├── docker-compose.yml
├── .env.example
└── .github/
    └── workflows/
        └── ci.yml
```

## API Documentation
Swagger UI available at `http://localhost:3000/api/docs` (dev only).

## Environment Variables
See `.env.example` for all required environment variables.
