import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { SessionsService } from './sessions.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/sessions')
export class AdminSessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get(':sessionId/events')
  getProctoringEvents(@Param('sessionId') sessionId: string) {
    return this.sessionsService.getProctoringEvents(sessionId);
  }
}
