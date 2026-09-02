import { ConflictException } from '@nestjs/common';
import { ExamAccessType } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AccessCodesService } from './access-codes.service';

describe('AccessCodesService atomic unlock', () => {
  const accessCodeFindUnique = jest.fn();
  const accessCodeUpdateMany = jest.fn();
  const examAccessFindUnique = jest.fn();
  const examAccessCreate = jest.fn();
  const transactionClient = {
    accessCode: {
      findUnique: accessCodeFindUnique,
      updateMany: accessCodeUpdateMany,
    },
    examAccess: {
      findUnique: examAccessFindUnique,
      create: examAccessCreate,
    },
  };
  const prisma = {
    $transaction: jest.fn(
      async (callback: (tx: typeof transactionClient) => unknown) =>
        callback(transactionClient),
    ),
  } as unknown as PrismaService;
  const service = new AccessCodesService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    accessCodeFindUnique.mockResolvedValue({
      id: 'code-1',
      code: 'TSA8K2M9',
      examId: 'exam-1',
      isActive: true,
      expiresAt: null,
      maxUses: 1,
      usedCount: 0,
      exam: {
        id: 'exam-1',
        title: 'Locked exam',
        accessType: ExamAccessType.LOCKED,
        isPublished: true,
        durationMins: 150,
      },
    });
    examAccessFindUnique.mockResolvedValue(null);
  });

  it('rejects an unlock when the guarded atomic increment affects no row', async () => {
    accessCodeUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.unlockExam('tsa8-k2m9', { id: 'user-1' } as never),
    ).rejects.toThrow(
      new ConflictException('Access code has no remaining uses'),
    );
    expect(examAccessCreate).not.toHaveBeenCalled();
  });

  it('does not consume another use when the exam is already unlocked', async () => {
    examAccessFindUnique.mockResolvedValue({
      grantedAt: new Date('2026-07-27T00:00:00.000Z'),
    });

    const result = await service.unlockExam(
      'TSA8K2M9',
      { id: 'user-1' } as never,
    );

    expect(result.alreadyUnlocked).toBe(true);
    expect(accessCodeUpdateMany).not.toHaveBeenCalled();
  });
});
