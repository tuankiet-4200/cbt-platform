import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { AccessCodesController } from './access-codes.controller';
import { AccessCodesService } from './access-codes.service';

@Module({
  imports: [PrismaModule],
  controllers: [AccessCodesController],
  providers: [AccessCodesService],
})
export class AccessCodesModule {}
