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
import { diskStorage } from 'multer';
import { extname } from 'path';
import { User, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ContributionsService } from './contributions.service';
import {
  CreateContributionDto,
  ListContributionsDto,
  UpdateContributionStatusDto,
} from './dto/contribution.dto';

const storage = diskStorage({
  destination: 'uploads',
  filename: (_req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${suffix}${extname(file.originalname).toLowerCase()}`);
  },
});

@Controller()
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('contributions')
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
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
    return this.contributionsService.createContribution(
      dto,
      `/uploads/${file.filename}`,
      file.mimetype === 'application/pdf' ? 'PDF' : 'DOCX',
      user,
    );
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
  @Patch('admin/contributions/:id/status')
  updateContributionStatus(
    @Param('id') id: string,
    @Body() dto: UpdateContributionStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.contributionsService.updateContributionStatus(id, dto, user);
  }
}

