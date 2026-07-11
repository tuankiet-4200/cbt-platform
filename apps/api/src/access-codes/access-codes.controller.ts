import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { AccessCodesService } from './access-codes.service';
import { CreateAccessCodeDto, UnlockExamDto } from './dto/access-code.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class AccessCodesController {
  constructor(private readonly accessCodesService: AccessCodesService) {}

  @Get('admin/access-codes')
  @Roles(UserRole.ADMIN)
  listAccessCodes() {
    return this.accessCodesService.listAccessCodes();
  }

  @Post('admin/access-codes')
  @Roles(UserRole.ADMIN)
  createAccessCode(@Body() dto: CreateAccessCodeDto, @CurrentUser() user: User) {
    return this.accessCodesService.createAccessCode(dto, user);
  }

  @Patch('admin/access-codes/:id/deactivate')
  @Roles(UserRole.ADMIN)
  deactivateAccessCode(@Param('id') id: string) {
    return this.accessCodesService.deactivateAccessCode(id);
  }

  @Post('exams/unlock')
  @Roles(UserRole.USER, UserRole.ADMIN)
  unlockExam(@Body() dto: UnlockExamDto, @CurrentUser() user: User) {
    return this.accessCodesService.unlockExam(dto.code, user);
  }
}
