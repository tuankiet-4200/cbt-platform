import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { User, UserRole } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { StorageService } from '@/common/storage/storage.service';

@Controller()
export class AdminController {
  constructor(private readonly storageService: StorageService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  uploadAsset(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: User) {
    if (!file) throw new BadRequestException('file is required');
    return this.storageService.uploadQuestionImage(file, user.id);
  }
}
