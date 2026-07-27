import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const userFindMany = jest.fn();
  const userCount = jest.fn();
  const prisma = {
    user: {
      findMany: userFindMany,
      count: userCount,
    },
  } as unknown as PrismaService;
  const service = new UsersService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns paginated filtered users with global summary counts', async () => {
    userFindMany.mockResolvedValue([
      {
        id: 'user-1',
        email: 'student@example.com',
        displayName: 'Student',
        role: UserRole.USER,
        isActive: true,
        _count: {
          examAttempts: 2,
          examAccesses: 1,
          contributions: 0,
        },
      },
    ]);
    userCount
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(2);

    const result = await service.listUsers({
      page: 1,
      limit: 20,
      search: 'student',
      role: UserRole.USER,
      isActive: true,
    });

    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: UserRole.USER,
          isActive: true,
          OR: expect.any(Array),
        }),
        skip: 0,
        take: 20,
      }),
    );
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    expect(result.summary).toEqual({ active: 8, admins: 2 });
  });

  it('prevents an admin from deactivating their own account', async () => {
    await expect(
      service.updateStatus(
        'admin-1',
        { isActive: false },
        'admin-1',
      ),
    ).rejects.toThrow(
      new ForbiddenException('You cannot deactivate your own account'),
    );
  });

  it('prevents an admin from changing their own role', async () => {
    await expect(
      service.updateRole('admin-1', { role: UserRole.USER }, 'admin-1'),
    ).rejects.toThrow(
      new ForbiddenException('You cannot change your own role'),
    );
  });
});
