import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UserRole } from '@prisma/client';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';

const storage = diskStorage({
  destination: 'uploads',
  filename: (_req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${suffix}${extname(file.originalname).toLowerCase()}`);
  },
});

@Controller()
export class AdminController {
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/upload')
  @UseInterceptors(FileInterceptor('file', { storage }))
  uploadAsset(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required');
    return {
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      mimeType: file.mimetype,
      size: file.size,
    };
  }
}
