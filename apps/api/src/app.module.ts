import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { QuestionsModule } from './questions/questions.module';
import { TagsModule } from './tags/tags.module';
import { ExamsModule } from './exams/exams.module';
import { SessionsModule } from './sessions/sessions.module';
import { ResultsModule } from './results/results.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    // ── Config (must be first) ─────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // ── Rate Limiting ──────────────────────────────────────────────────────
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,   // 1 second window
        limit: 10,   // 10 requests per second (default)
      },
      {
        name: 'medium',
        ttl: 60000,  // 1 minute window
        limit: 300,  // 300 requests per minute
      },
    ]),

    // ── Cron Jobs ──────────────────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ── Infrastructure ─────────────────────────────────────────────────────
    PrismaModule,
    RedisModule,

    // ── Feature Modules ────────────────────────────────────────────────────
    HealthModule,
    AuthModule,
    UsersModule,
    QuestionsModule,
    TagsModule,
    ExamsModule,
    SessionsModule,
    ResultsModule,
    AnalyticsModule,
    AdminModule,
  ],
})
export class AppModule {}
