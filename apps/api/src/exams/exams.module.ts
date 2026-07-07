import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { ExamBlueprintsController } from './exam-blueprints.controller';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';

@Module({
  imports: [PrismaModule],
  controllers: [ExamsController, ExamBlueprintsController],
  providers: [ExamsService],
})
export class ExamsModule {}
