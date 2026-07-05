import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ExamAccessType, User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '@/common/prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const REFRESH_TOKEN_DAYS = 7;
const DEFAULT_EXAM_ID = 'default-exam-id-placeholder';

type SafeUser = Pick<User, 'id' | 'email' | 'displayName' | 'role'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta) {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          displayName: dto.displayName.trim(),
          role: UserRole.USER,
        },
      });

      const defaultExam = await tx.exam.findFirst({
        where: {
          OR: [
            { id: DEFAULT_EXAM_ID },
            { accessType: ExamAccessType.PUBLIC, isPublished: true },
          ],
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });

      if (defaultExam) {
        await tx.examAccess.upsert({
          where: {
            userId_examId: {
              userId: created.id,
              examId: defaultExam.id,
            },
          },
          update: {},
          create: {
            userId: created.id,
            examId: defaultExam.id,
          },
        });
      }

      return created;
    });

    return this.issueSession(user, meta);
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueSession(user, meta);
  }

  async refresh(rawToken: string | undefined, meta: RequestMeta) {
    if (!rawToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    if (stored.isRevoked || stored.expiresAt <= new Date()) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, isRevoked: false },
        data: { isRevoked: true },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (!stored.user.isActive) {
      throw new UnauthorizedException('User is inactive');
    }

    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = this.hashToken(refreshToken);
    const expiresAt = this.refreshExpiry();

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { isRevoked: true },
      }),
      this.prisma.refreshToken.create({
        data: {
          token: refreshTokenHash,
          userId: stored.userId,
          expiresAt,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      }),
    ]);

    return {
      user: this.toSafeUser(stored.user),
      accessToken: this.signAccessToken(stored.user),
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  async logout(rawToken: string | undefined) {
    if (rawToken) {
      await this.prisma.refreshToken.updateMany({
        where: { token: this.hashToken(rawToken), isRevoked: false },
        data: { isRevoked: true },
      });
    }
    return { ok: true };
  }

  private async issueSession(user: User, meta: RequestMeta) {
    const refreshToken = this.generateRefreshToken();
    const expiresAt = this.refreshExpiry();

    await this.prisma.refreshToken.create({
      data: {
        token: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return {
      user: this.toSafeUser(user),
      accessToken: this.signAccessToken(user),
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  private signAccessToken(user: SafeUser) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  private generateRefreshToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshExpiry() {
    return new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  }

  private toSafeUser(user: SafeUser): SafeUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

