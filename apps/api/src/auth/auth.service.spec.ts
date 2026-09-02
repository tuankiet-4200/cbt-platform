import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService refresh-token reuse detection', () => {
  const refreshTokenFindUnique = jest.fn();
  const refreshTokenUpdateMany = jest.fn();
  const prisma = {
    refreshToken: {
      findUnique: refreshTokenFindUnique,
      updateMany: refreshTokenUpdateMany,
    },
  } as unknown as PrismaService;
  const jwt = {} as JwtService;
  const config = {} as ConfigService;
  const service = new AuthService(prisma, jwt, config);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('revokes all active sessions when a rotated token is reused after the grace window', async () => {
    refreshTokenFindUnique.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      isRevoked: true,
      revokedAt: new Date(Date.now() - 6_000),
      revocationReason: 'ROTATED',
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-1', isActive: true },
    });
    refreshTokenUpdateMany.mockResolvedValue({ count: 2 });

    await expect(
      service.refresh('reused-token', {}),
    ).rejects.toThrow(new UnauthorizedException('Refresh token is invalid'));
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isRevoked: false },
      data: expect.objectContaining({
        isRevoked: true,
        revocationReason: 'REUSE_DETECTED',
        revokedAt: expect.any(Date),
      }),
    });
  });

  it('does not revoke the successor during a concurrent multi-tab rotation', async () => {
    refreshTokenFindUnique.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      isRevoked: true,
      revokedAt: new Date(),
      revocationReason: 'ROTATED',
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-1', isActive: true },
    });

    await expect(
      service.refresh('concurrent-token', {}),
    ).rejects.toThrow(new UnauthorizedException('Refresh token is invalid'));
    expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
  });
});
