import { Injectable, NotFoundException } from '@nestjs/common';
import { ExamSectionType, Prisma, SessionStatus } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';
import { AnalyticsHistoryQueryDto } from './dto/analytics-query.dto';

type TagBreakdownRow = {
  tagId: string;
  tagName: string;
  correct: number;
  total: number;
};

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getExamHistory(
    userId: string,
    examId: string,
    query: AnalyticsHistoryQueryDto,
  ) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, title: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const where: Prisma.ExamAttemptWhereInput = {
      userId,
      examId,
      status: SessionStatus.GRADED,
      result: { isNot: null },
    };
    const [total, attempts] = await Promise.all([
      this.prisma.examAttempt.count({ where }),
      this.prisma.examAttempt.findMany({
        where,
        orderBy: { completedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          selectedSections: true,
          startedAt: true,
          completedAt: true,
          result: {
            select: {
              totalScore: true,
              maxScore: true,
              percentScore: true,
              correctCount: true,
              wrongCount: true,
              skippedCount: true,
              durationSecs: true,
              sectionScores: true,
              completedAt: true,
            },
          },
        },
      }),
    ]);

    return {
      exam,
      data: attempts.map((attempt, index) => ({
        ...attempt,
        attemptNumber: total - ((query.page - 1) * query.limit + index),
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getWeaknesses(userId: string) {
    const results = await this.prisma.examResult.findMany({
      where: { attempt: { userId } },
      orderBy: { completedAt: 'desc' },
      take: 50,
      select: { tagBreakdown: true },
    });
    const aggregate = new Map<string, TagBreakdownRow>();
    for (const result of results) {
      for (const row of this.readTagBreakdown(result.tagBreakdown)) {
        const current = aggregate.get(row.tagId) ?? {
          tagId: row.tagId,
          tagName: row.tagName,
          correct: 0,
          total: 0,
        };
        current.correct += row.correct;
        current.total += row.total;
        aggregate.set(row.tagId, current);
      }
    }

    const tags = [...aggregate.values()]
      .map((tag) => ({
        ...tag,
        accuracy: tag.total > 0 ? (tag.correct / tag.total) * 100 : 0,
      }))
      .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);

    return {
      attemptsAnalyzed: results.length,
      tags,
      weaknesses: tags.slice(0, 5),
      strengths: [...tags].reverse().slice(0, 5),
    };
  }

  async getTimeAnalysis(userId: string) {
    const answers = await this.prisma.sessionAnswer.findMany({
      where: {
        session: {
          attempt: { userId, status: SessionStatus.GRADED },
        },
      },
      select: {
        timeSpentMs: true,
        isCorrect: true,
        session: { select: { sectionType: true } },
        question: { select: { expectedTimeSecs: true } },
      },
    });

    const sections = new Map<
      ExamSectionType,
      {
        section: ExamSectionType;
        answered: number;
        correct: number;
        actualMs: number;
        expectedMs: number;
      }
    >();
    for (const answer of answers) {
      const row = sections.get(answer.session.sectionType) ?? {
        section: answer.session.sectionType,
        answered: 0,
        correct: 0,
        actualMs: 0,
        expectedMs: 0,
      };
      row.answered += 1;
      if (answer.isCorrect) row.correct += 1;
      row.actualMs += answer.timeSpentMs ?? 0;
      row.expectedMs += answer.question.expectedTimeSecs * 1_000;
      sections.set(answer.session.sectionType, row);
    }

    const data = [...sections.values()].map((row) => {
      const averageTimeSecs = row.answered
        ? row.actualMs / row.answered / 1_000
        : 0;
      const expectedTimeSecs = row.answered
        ? row.expectedMs / row.answered / 1_000
        : 0;
      return {
        section: row.section,
        answered: row.answered,
        accuracy: row.answered ? (row.correct / row.answered) * 100 : 0,
        averageTimeSecs,
        expectedTimeSecs,
        paceRatio:
          expectedTimeSecs > 0 ? averageTimeSecs / expectedTimeSecs : 0,
      };
    });

    const totalAnswered = data.reduce((sum, row) => sum + row.answered, 0);
    return {
      totalAnswered,
      averageTimeSecs: totalAnswered
        ? answers.reduce((sum, answer) => sum + (answer.timeSpentMs ?? 0), 0) /
          totalAnswered /
          1_000
        : 0,
      sections: data,
    };
  }

  async getLeaderboard(examId: string, userId: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, isPublished: true },
      select: { id: true, title: true },
    });
    if (!exam) throw new NotFoundException('Published exam not found');

    const values = await this.redis.zrevrange(
      `leaderboard:${examId}`,
      0,
      99,
      true,
    );
    const ranked = Array.from({ length: values.length / 2 }, (_, index) => ({
      userId: values[index * 2],
      score: Number(values[index * 2 + 1]),
      rank: index + 1,
    }));
    const users = await this.prisma.user.findMany({
      where: { id: { in: ranked.map((row) => row.userId) } },
      select: { id: true, displayName: true },
    });
    const names = new Map(users.map((user) => [user.id, user.displayName]));
    const entries = ranked.map((row) => ({
      rank: row.rank,
      userId: row.userId,
      displayName: names.get(row.userId) ?? 'Học viên',
      percentScore: row.score,
      isCurrentUser: row.userId === userId,
    }));
    const currentEntry = entries.find((entry) => entry.isCurrentUser);
    const currentRank = currentEntry
      ? currentEntry
      : await this.getCurrentRank(examId, userId, names.get(userId));

    return { exam, entries, currentUser: currentRank };
  }

  private async getCurrentRank(
    examId: string,
    userId: string,
    displayName?: string,
  ) {
    const [rank, score] = await Promise.all([
      this.redis.zrevrank(`leaderboard:${examId}`, userId),
      this.redis.zscore(`leaderboard:${examId}`, userId),
    ]);
    if (rank === null || score === null) return null;
    return {
      rank: rank + 1,
      userId,
      displayName: displayName ?? 'Bạn',
      percentScore: score,
      isCurrentUser: true,
    };
  }

  private readTagBreakdown(value: Prisma.JsonValue): TagBreakdownRow[] {
    if (!Array.isArray(value)) return [];
    return value.filter((row): row is TagBreakdownRow => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
      return (
        typeof row.tagId === 'string' &&
        typeof row.tagName === 'string' &&
        typeof row.correct === 'number' &&
        typeof row.total === 'number'
      );
    });
  }
}
