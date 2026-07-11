import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExamAccessType, Prisma, User } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CreateAccessCodeDto } from './dto/access-code.dto';

const CODE_LENGTH = 8;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_UNLOCK_RETRIES = 2;

@Injectable()
export class AccessCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async listAccessCodes() {
    const codes = await this.prisma.accessCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            accessType: true,
            isPublished: true,
            durationMins: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
        _count: {
          select: {
            accesses: true,
          },
        },
      },
    });

    return codes.map((code) => ({
      id: code.id,
      code: code.code,
      examId: code.examId,
      exam: code.exam,
      maxUses: code.maxUses,
      usedCount: code.usedCount,
      expiresAt: code.expiresAt,
      isActive: code.isActive,
      createdAt: code.createdAt,
      createdBy: code.createdBy,
      counts: {
        accesses: code._count.accesses,
      },
      status: this.resolveCodeStatus(code),
    }));
  }

  async createAccessCode(dto: CreateAccessCodeDto, createdBy: User) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: dto.examId },
      select: {
        id: true,
        title: true,
        accessType: true,
        isPublished: true,
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    if (exam.accessType !== ExamAccessType.LOCKED) {
      throw new BadRequestException('Access codes can only be created for LOCKED exams');
    }
    if (!exam.isPublished) {
      throw new BadRequestException('Publish the exam before creating access codes');
    }

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException('Expiration must be in the future');
    }

    const code = await this.generateUniqueCode();
    return this.prisma.accessCode.create({
      data: {
        code,
        examId: dto.examId,
        maxUses: dto.maxUses ?? null,
        expiresAt,
        createdById: createdBy.id,
      },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            accessType: true,
            isPublished: true,
            durationMins: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
        _count: {
          select: {
            accesses: true,
          },
        },
      },
    });
  }

  async deactivateAccessCode(id: string) {
    await this.assertAccessCodeExists(id);
    return this.prisma.accessCode.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async unlockExam(rawCode: string, user: User) {
    const code = this.normalizeCode(rawCode);
    if (!code) throw new BadRequestException('Access code is required');

    for (let attempt = 0; attempt <= MAX_UNLOCK_RETRIES; attempt += 1) {
      try {
        return await this.unlockExamOnce(code, user.id);
      } catch (error) {
        if (this.isSerializableRetry(error) && attempt < MAX_UNLOCK_RETRIES) continue;
        throw error;
      }
    }

    throw new ConflictException('Could not unlock exam. Please try again.');
  }

  private async unlockExamOnce(code: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const accessCode = await tx.accessCode.findUnique({
        where: { code },
        include: {
          exam: {
            select: {
              id: true,
              title: true,
              accessType: true,
              isPublished: true,
              durationMins: true,
            },
          },
        },
      });

      if (!accessCode) throw new NotFoundException('Access code not found');
      if (!accessCode.isActive) throw new BadRequestException('Access code is inactive');
      if (accessCode.expiresAt && accessCode.expiresAt <= new Date()) {
        throw new BadRequestException('Access code has expired');
      }
      if (!accessCode.exam.isPublished) throw new BadRequestException('Exam is not published');

      const existingAccess = await tx.examAccess.findUnique({
        where: {
          userId_examId: {
            userId,
            examId: accessCode.examId,
          },
        },
      });
      if (existingAccess) {
        return {
          ok: true,
          alreadyUnlocked: true,
          exam: accessCode.exam,
          grantedAt: existingAccess.grantedAt,
        };
      }

      const increment = await tx.accessCode.updateMany({
        where: {
          id: accessCode.id,
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
          AND: [
            {
              OR: [
                { maxUses: null },
                { usedCount: { lt: accessCode.maxUses ?? 0 } },
              ],
            },
          ],
        },
        data: {
          usedCount: { increment: 1 },
        },
      });
      if (increment.count !== 1) {
        throw new ConflictException('Access code has no remaining uses');
      }

      const access = await tx.examAccess.create({
        data: {
          userId,
          examId: accessCode.examId,
          accessCodeId: accessCode.id,
        },
      });

      return {
        ok: true,
        alreadyUnlocked: false,
        exam: accessCode.exam,
        grantedAt: access.grantedAt,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  private async assertAccessCodeExists(id: string) {
    const accessCode = await this.prisma.accessCode.findUnique({ where: { id }, select: { id: true } });
    if (!accessCode) throw new NotFoundException('Access code not found');
  }

  private async generateUniqueCode() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = this.generateCode();
      const exists = await this.prisma.accessCode.findUnique({ where: { code }, select: { id: true } });
      if (!exists) return code;
    }
    throw new ConflictException('Could not generate a unique access code');
  }

  private generateCode() {
    const bytes = randomBytes(CODE_LENGTH);
    return Array.from(bytes)
      .map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length])
      .join('');
  }

  private normalizeCode(code: string) {
    return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private resolveCodeStatus(code: { isActive: boolean; expiresAt: Date | null; maxUses: number | null; usedCount: number }) {
    if (!code.isActive) return 'INACTIVE';
    if (code.expiresAt && code.expiresAt <= new Date()) return 'EXPIRED';
    if (code.maxUses !== null && code.usedCount >= code.maxUses) return 'EXHAUSTED';
    return 'ACTIVE';
  }

  private isSerializableRetry(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002');
  }
}
