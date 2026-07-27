import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  ChangePasswordDto,
  ListUsersDto,
  UpdateMyProfileDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from './dto/user.dto';

const USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...USER_SELECT,
        _count: {
          select: {
            examAttempts: true,
            examAccesses: true,
            contributions: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateMe(userId: string, dto: UpdateMyProfileDto) {
    const displayName = dto.displayName.trim();
    if (displayName.length < 2) {
      throw new BadRequestException(
        'Display name must contain at least 2 non-space characters',
      );
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { displayName },
      select: USER_SELECT,
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const matches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const unchanged = await bcrypt.compare(
      dto.newPassword,
      user.passwordHash,
    );
    if (unchanged) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      }),
    ]);
    return { ok: true, requiresLogin: true };
  }

  async listUsers(dto: ListUsersDto) {
    const search = dto.search?.trim();
    const where: Prisma.UserWhereInput = {
      ...(dto.role ? { role: dto.role } : {}),
      ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { displayName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [users, total, active, admins] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        select: {
          ...USER_SELECT,
          _count: {
            select: {
              examAttempts: true,
              examAccesses: true,
              contributions: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
    ]);
    return {
      data: users,
      meta: {
        page: dto.page,
        limit: dto.limit,
        total,
        totalPages: Math.ceil(total / dto.limit),
      },
      summary: { active, admins },
    };
  }

  async updateStatus(
    userId: string,
    dto: UpdateUserStatusDto,
    adminId: string,
  ) {
    if (userId === adminId && !dto.isActive) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }
    await this.assertUser(userId);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { isActive: dto.isActive },
        select: USER_SELECT,
      });
      if (!dto.isActive) {
        await tx.refreshToken.updateMany({
          where: { userId, isRevoked: false },
          data: { isRevoked: true },
        });
      }
      return user;
    });
  }

  async updateRole(
    userId: string,
    dto: UpdateUserRoleDto,
    adminId: string,
  ) {
    if (userId === adminId) {
      throw new ForbiddenException('You cannot change your own role');
    }
    await this.assertUser(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role },
      select: USER_SELECT,
    });
  }

  private async assertUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
  }
}
