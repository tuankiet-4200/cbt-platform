import { BadRequestException, Injectable } from '@nestjs/common';
import { ContributionStatus, Prisma, User } from '@prisma/client';
import { paginate } from '@/common/dto/pagination.dto';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  CreateContributionDto,
  ListContributionsDto,
  UpdateContributionStatusDto,
} from './dto/contribution.dto';

@Injectable()
export class ContributionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createContribution(dto: CreateContributionDto, fileUrl: string, fileType: string, currentUser: User) {
    return this.prisma.contributionSubmission.create({
      data: {
        title: dto.title,
        description: dto.description,
        fileUrl,
        fileType,
        submitterId: currentUser.id,
      },
    });
  }

  async listMyContributions(dto: ListContributionsDto, currentUser: User) {
    const where: Prisma.ContributionSubmissionWhereInput = {
      submitterId: currentUser.id,
      status: dto.status,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.contributionSubmission.findMany({
        where,
        skip: dto.skip,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contributionSubmission.count({ where }),
    ]);

    return paginate(data, total, dto);
  }

  async listContributions(dto: ListContributionsDto) {
    const where: Prisma.ContributionSubmissionWhereInput = { status: dto.status };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.contributionSubmission.findMany({
        where,
        skip: dto.skip,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          submitter: { select: { id: true, email: true, displayName: true } },
          reviewedBy: { select: { id: true, email: true, displayName: true } },
        },
      }),
      this.prisma.contributionSubmission.count({ where }),
    ]);

    return paginate(data, total, dto);
  }

  async updateContributionStatus(id: string, dto: UpdateContributionStatusDto, currentUser: User) {
    if (dto.status === ContributionStatus.PENDING) {
      throw new BadRequestException('Admin cannot move contribution back to PENDING');
    }

    return this.prisma.contributionSubmission.update({
      where: { id },
      data: {
        status: dto.status,
        adminNote: dto.adminNote,
        reviewedById: currentUser.id,
        reviewedAt: new Date(),
      },
    });
  }
}

