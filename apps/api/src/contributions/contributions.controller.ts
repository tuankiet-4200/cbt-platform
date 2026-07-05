import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { User, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { StorageService } from '@/common/storage/storage.service';
import { ContributionsService } from './contributions.service';
import {
  CreateContributionDto,
  ListContributionsDto,
  UpdateContributionStatusDto,
} from './dto/contribution.dto';

@Controller()
export class ContributionsController {
  constructor(
    private readonly contributionsService: ContributionsService,
    private readonly storageService: StorageService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('contributions')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        cb(null, allowed.includes(file.mimetype));
      },
    }),
  )
  createContribution(
    @Body() dto: CreateContributionDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: User,
  ) {
    if (!file) throw new BadRequestException('PDF or DOCX file is required');
    return this.createContributionWithUpload(dto, file, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('contributions/:id/file-url')
  createMyContributionFileUrl(@Param('id') id: string, @CurrentUser() user: User) {
    return this.contributionsService.createContributionFileUrl(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('contributions/mine')
  listMyContributions(@Query() dto: ListContributionsDto, @CurrentUser() user: User) {
    return this.contributionsService.listMyContributions(dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/contributions')
  listContributions(@Query() dto: ListContributionsDto) {
    return this.contributionsService.listContributions(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/contributions/:id/file-url')
  createAdminContributionFileUrl(@Param('id') id: string, @CurrentUser() user: User) {
    return this.contributionsService.createContributionFileUrl(id, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('admin/contributions/:id/status')
  updateContributionStatus(
    @Param('id') id: string,
    @Body() dto: UpdateContributionStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.contributionsService.updateContributionStatus(id, dto, user);
  }

  private async createContributionWithUpload(
    dto: CreateContributionDto,
    file: Express.Multer.File,
    user: User,
  ) {
    const uploaded = await this.storageService.uploadContributionFile(file, user.id);
    return this.contributionsService.createContribution(
      dto,
      uploaded.url,
      uploaded.fileType,
      user,
    );
  }
}
