import { BadRequestException } from '@nestjs/common';
import { ContributionStatus, UserRole } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/common/storage/storage.service';
import { ContributionsService } from './contributions.service';

describe('ContributionsService status workflow', () => {
  const contributionFindUnique = jest.fn();
  const contributionUpdate = jest.fn();
  const prisma = {
    contributionSubmission: {
      findUnique: contributionFindUnique,
      update: contributionUpdate,
    },
  } as unknown as PrismaService;
  const storage = {} as StorageService;
  const service = new ContributionsService(prisma, storage);
  const admin = {
    id: 'admin-1',
    role: UserRole.ADMIN,
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    contributionUpdate.mockResolvedValue({ id: 'submission-1' });
  });

  it('allows PENDING to move to REVIEWING', async () => {
    contributionFindUnique.mockResolvedValue({
      id: 'submission-1',
      status: ContributionStatus.PENDING,
    });

    await service.updateContributionStatus(
      'submission-1',
      { status: ContributionStatus.REVIEWING },
      admin,
    );

    expect(contributionUpdate).toHaveBeenCalled();
  });

  it('blocks skipping REVIEWING and terminal-state rewrites', async () => {
    contributionFindUnique.mockResolvedValue({
      id: 'submission-1',
      status: ContributionStatus.PENDING,
    });

    await expect(
      service.updateContributionStatus(
        'submission-1',
        { status: ContributionStatus.APPROVED },
        admin,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(contributionUpdate).not.toHaveBeenCalled();
  });
});
