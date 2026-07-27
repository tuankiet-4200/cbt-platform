import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExamSectionType, SessionStatus } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { GradingService } from './grading.service';
import { extractCorrectAnswer } from './grading.util';

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly grading: GradingService,
  ) {}

  async getResult(attemptId: string, userId: string) {
    const attempt = await this.ensureGraded(attemptId, userId);
    if (!attempt.result) {
      throw new ConflictException('Exam result is still being processed');
    }
    return {
      ...attempt.result,
      exam: attempt.exam,
      startedAt: attempt.startedAt,
      attemptCompletedAt: attempt.completedAt,
    };
  }

  async getAnswerReview(attemptId: string, userId: string) {
    const attempt = await this.ensureGraded(attemptId, userId);
    if (!attempt.result) {
      throw new ConflictException('Exam result is still being processed');
    }

    const [math, bundleRows, sessions] = await Promise.all([
      this.prisma.examMathQuestion.findMany({
        where: { examId: attempt.examId },
        orderBy: { orderInSection: 'asc' },
        include: {
          question: {
            select: {
              id: true,
              type: true,
              contentJson: true,
              expectedTimeSecs: true,
              tags: {
                select: { tag: { select: { id: true, name: true } } },
              },
            },
          },
        },
      }),
      this.prisma.examPassageBundle.findMany({
        where: { examId: attempt.examId },
        orderBy: [
          { sectionType: 'asc' },
          { orderInSection: 'asc' },
        ],
        include: {
          passageBundle: {
            select: {
              id: true,
              title: true,
              contentJson: true,
              questions: {
                orderBy: { orderInBundle: 'asc' },
                include: {
                  question: {
                    select: {
                      id: true,
                      type: true,
                      contentJson: true,
                      expectedTimeSecs: true,
                      tags: {
                        select: {
                          tag: { select: { id: true, name: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.examSession.findMany({
        where: { attemptId },
        include: { answers: true },
      }),
    ]);

    const answerMap = new Map(
      sessions.flatMap((session) =>
        session.answers.map((answer) => [
          answer.questionId,
          {
            answerJson: answer.answerJson,
            isCorrect: answer.isCorrect,
            pointsEarned: answer.pointsEarned,
            timeSpentMs: answer.timeSpentMs,
          },
        ] as const),
      ),
    );

    const toReviewQuestion = (
      question: (typeof math)[number]['question'],
      points: number,
      order: number,
    ) => {
      const answer = answerMap.get(question.id);
      return {
        id: question.id,
        type: question.type,
        order,
        points,
        expectedTimeSecs: question.expectedTimeSecs,
        content: question.contentJson,
        userAnswer: answer?.answerJson ?? null,
        correctAnswer: extractCorrectAnswer(
          question.type,
          question.contentJson,
        ),
        isCorrect: answer?.isCorrect ?? null,
        pointsEarned: answer?.pointsEarned ?? 0,
        timeSpentMs: answer?.timeSpentMs ?? 0,
        tags: question.tags.map((item) => item.tag),
      };
    };

    return {
      attemptId,
      exam: attempt.exam,
      sections: {
        MATH: {
          questions: math.map((item) =>
            toReviewQuestion(
              item.question,
              item.points,
              item.orderInSection,
            ),
          ),
        },
        READING: {
          bundles: bundleRows
            .filter(
              (item) => item.sectionType === ExamSectionType.READING,
            )
            .map((item) => ({
              id: item.passageBundle.id,
              title: item.passageBundle.title,
              content: item.passageBundle.contentJson,
              order: item.orderInSection,
              questions: item.passageBundle.questions.map((question) =>
                toReviewQuestion(
                  question.question,
                  question.points,
                  question.orderInBundle,
                ),
              ),
            })),
        },
        SCIENCE: {
          bundles: bundleRows
            .filter(
              (item) => item.sectionType === ExamSectionType.SCIENCE,
            )
            .map((item) => ({
              id: item.passageBundle.id,
              title: item.passageBundle.title,
              content: item.passageBundle.contentJson,
              order: item.orderInSection,
              questions: item.passageBundle.questions.map((question) =>
                toReviewQuestion(
                  question.question,
                  question.points,
                  question.orderInBundle,
                ),
              ),
            })),
        },
      },
    };
  }

  private async ensureGraded(attemptId: string, userId: string) {
    let attempt = await this.prisma.examAttempt.findFirst({
      where: { id: attemptId, userId },
      include: {
        exam: {
          select: { id: true, title: true, totalPoints: true },
        },
        result: true,
      },
    });
    if (!attempt) throw new NotFoundException('Exam attempt not found');
    if (attempt.status === SessionStatus.IN_PROGRESS) {
      throw new ConflictException('Exam attempt is still in progress');
    }
    if (!attempt.result) {
      await this.grading.gradeAttempt(attemptId);
      attempt = await this.prisma.examAttempt.findFirst({
        where: { id: attemptId, userId },
        include: {
          exam: {
            select: { id: true, title: true, totalPoints: true },
          },
          result: true,
        },
      });
      if (!attempt) throw new NotFoundException('Exam attempt not found');
    }
    return attempt;
  }
}
