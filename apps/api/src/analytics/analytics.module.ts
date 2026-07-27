import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { RedisModule } from '@/common/redis/redis.module';
import {
  AnalyticsController,
  LeaderboardController,
} from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [AnalyticsController, LeaderboardController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
