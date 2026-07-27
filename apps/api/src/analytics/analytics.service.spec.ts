import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  const resultFindMany = jest.fn();
  const examFindFirst = jest.fn();
  const userFindMany = jest.fn();
  const zrevrange = jest.fn();
  const zrevrank = jest.fn();
  const zscore = jest.fn();
  const prisma = {
    examResult: { findMany: resultFindMany },
    exam: { findFirst: examFindFirst },
    user: { findMany: userFindMany },
  } as unknown as PrismaService;
  const redis = {
    zrevrange,
    zrevrank,
    zscore,
  } as unknown as RedisService;
  const service = new AnalyticsService(prisma, redis);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aggregates tag accuracy across recent attempts', async () => {
    resultFindMany.mockResolvedValue([
      {
        tagBreakdown: [
          { tagId: 'algebra', tagName: 'Đại số', correct: 3, total: 5 },
          { tagId: 'geometry', tagName: 'Hình học', correct: 1, total: 5 },
        ],
      },
      {
        tagBreakdown: [
          { tagId: 'algebra', tagName: 'Đại số', correct: 4, total: 5 },
        ],
      },
    ]);

    const result = await service.getWeaknesses('user-1');

    expect(result.attemptsAnalyzed).toBe(2);
    expect(result.tags).toEqual([
      expect.objectContaining({ tagId: 'geometry', accuracy: 20 }),
      expect.objectContaining({
        tagId: 'algebra',
        correct: 7,
        total: 10,
        accuracy: 70,
      }),
    ]);
    expect(result.weaknesses[0].tagId).toBe('geometry');
    expect(result.strengths[0].tagId).toBe('algebra');
  });

  it('hydrates Redis leaderboard entries and highlights the current user', async () => {
    examFindFirst.mockResolvedValue({ id: 'exam-1', title: 'TSA Mock' });
    zrevrange.mockResolvedValue(['user-2', '95.5', 'user-1', '88']);
    userFindMany.mockResolvedValue([
      { id: 'user-1', displayName: 'Nguyễn Văn A' },
      { id: 'user-2', displayName: 'Trần Văn B' },
    ]);

    const result = await service.getLeaderboard('exam-1', 'user-1');

    expect(zrevrange).toHaveBeenCalledWith(
      'leaderboard:exam-1',
      0,
      99,
      true,
    );
    expect(result.entries).toEqual([
      expect.objectContaining({
        rank: 1,
        displayName: 'Trần Văn B',
        percentScore: 95.5,
        isCurrentUser: false,
      }),
      expect.objectContaining({
        rank: 2,
        displayName: 'Nguyễn Văn A',
        percentScore: 88,
        isCurrentUser: true,
      }),
    ]);
    expect(result.currentUser?.rank).toBe(2);
    expect(zrevrank).not.toHaveBeenCalled();
    expect(zscore).not.toHaveBeenCalled();
  });
});
