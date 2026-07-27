import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { RedisModule } from '@/common/redis/redis.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { AdminSessionsController } from './admin-sessions.controller';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [SessionsController, AdminSessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
