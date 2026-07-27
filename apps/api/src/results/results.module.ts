import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { RedisModule } from '@/common/redis/redis.module';
import { GradingService } from './grading.service';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [ResultsController],
  providers: [GradingService, ResultsService],
  exports: [GradingService],
})
export class ResultsModule {}
