import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ExamSectionType,
  Prisma,
  QuestionType,
  SessionStatus,
} from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { GradingService } from './grading.service';
import { extractCorrectAnswer } from './grading.util';
import { ResultReviewQueryDto } from './dto/result-review-query.dto';

type ReviewQuestionSource = {
  id: string;
  type: QuestionType;
  contentJson: Prisma.JsonValue;
  expectedTimeSecs: number;
  tags: Array<{ tag: { id: string; name: string } }>;
};

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
    const availableSections = this.availableSections(attempt.exam);
    return {
      ...attempt.result,
      exam: this.publicExam(attempt.exam),
      selectedSections: attempt.selectedSections.length > 0
        ? attempt.selectedSections
        : availableSections,
      availableSections,
      candidate: attempt.user,
      startedAt: attempt.sessions[0]?.startTime ?? attempt.startedAt,
      attemptCompletedAt: attempt.completedAt,
    };
  }

  async getAnswerReview(
    attemptId: string,
    userId: string,
    query: ResultReviewQueryDto,
  ) {
    const attempt = await this.ensureGraded(attemptId, userId);
    if (!attempt.result) {
      throw new ConflictException('Exam result is still being processed');
    }
    const availableSections = this.availableSections(attempt.exam);
    const selectedSections = attempt.selectedSections.length > 0
      ? attempt.selectedSections
      : availableSections;
    if (!selectedSections.includes(query.section)) {
      throw new BadRequestException(
        `Section ${query.section} was not included in this attempt`,
      );
    }

    const skip = (query.page - 1) * query.limit;
    if (query.section === ExamSectionType.MATH) {
      const [total, rows] = await Promise.all([
        this.prisma.examMathQuestion.count({
          where: { examId: attempt.examId },
        }),
        this.prisma.examMathQuestion.findMany({
          where: { examId: attempt.examId },
          orderBy: { orderInSection: 'asc' },
          skip,
          take: query.limit,
          include: { question: { select: this.reviewQuestionSelect() } },
        }),
      ]);
      const answerMap = await this.loadAnswers(
        attemptId,
        rows.map((row) => row.question.id),
      );
      return {
        attemptId,
        exam: this.publicExam(attempt.exam),
        section: query.section,
        questions: rows.map((row) =>
          this.toReviewQuestion(
            row.question,
            row.points,
            row.orderInSection,
            answerMap,
          ),
        ),
        bundles: [],
        meta: this.reviewMeta(query, total, 'QUESTION'),
      };
    }

    const where = {
      examId: attempt.examId,
      sectionType: query.section,
    };
    const [total, rows] = await Promise.all([
      this.prisma.examPassageBundle.count({ where }),
      this.prisma.examPassageBundle.findMany({
        where,
        orderBy: { orderInSection: 'asc' },
        skip,
        take: query.limit,
        include: {
          passageBundle: {
            select: {
              id: true,
              title: true,
              contentJson: true,
              questions: {
                orderBy: { orderInBundle: 'asc' },
                include: {
                  question: { select: this.reviewQuestionSelect() },
                },
              },
            },
          },
        },
      }),
    ]);
    const questionIds = rows.flatMap((row) =>
      row.passageBundle.questions.map((item) => item.question.id),
    );
    const answerMap = await this.loadAnswers(attemptId, questionIds);
    return {
      attemptId,
      exam: this.publicExam(attempt.exam),
      section: query.section,
      questions: [],
      bundles: rows.map((row) => ({
        id: row.passageBundle.id,
        title: row.passageBundle.title,
        content: row.passageBundle.contentJson,
        order: row.orderInSection,
        questions: row.passageBundle.questions.map((item) =>
          this.toReviewQuestion(
            item.question,
            item.points,
            item.orderInBundle,
            answerMap,
          ),
        ),
      })),
      meta: this.reviewMeta(query, total, 'BUNDLE'),
    };
  }

  private reviewQuestionSelect() {
    return {
      id: true,
      type: true,
      contentJson: true,
      expectedTimeSecs: true,
      tags: {
        select: { tag: { select: { id: true, name: true } } },
      },
    } satisfies Prisma.QuestionSelect;
  }

  private async loadAnswers(attemptId: string, questionIds: string[]) {
    const answers = await this.prisma.sessionAnswer.findMany({
      where: {
        session: { attemptId },
        questionId: { in: questionIds },
      },
    });
    return new Map(
      answers.map((answer) => [
        answer.questionId,
        {
          answerJson: answer.answerJson,
          isCorrect: answer.isCorrect,
          pointsEarned: answer.pointsEarned,
          timeSpentMs: answer.timeSpentMs,
        },
      ]),
    );
  }

  private toReviewQuestion(
    question: ReviewQuestionSource,
    points: number,
    order: number,
    answerMap: Map<
      string,
      {
        answerJson: Prisma.JsonValue | null;
        isCorrect: boolean | null;
        pointsEarned: number | null;
        timeSpentMs: number | null;
      }
    >,
  ) {
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
  }

  private reviewMeta(
    query: ResultReviewQueryDto,
    total: number,
    unit: 'QUESTION' | 'BUNDLE',
  ) {
    return {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      unit,
    };
  }

  private async ensureGraded(attemptId: string, userId: string) {
    let attempt = await this.prisma.examAttempt.findFirst({
      where: { id: attemptId, userId },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            totalPoints: true,
            _count: { select: { mathQuestions: true } },
            passageBundles: { select: { sectionType: true } },
          },
        },
        user: { select: { id: true, displayName: true } },
        sessions: {
          orderBy: { startTime: 'asc' },
          take: 1,
          select: { startTime: true },
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
            select: {
              id: true,
              title: true,
              totalPoints: true,
              _count: { select: { mathQuestions: true } },
              passageBundles: { select: { sectionType: true } },
            },
          },
          user: { select: { id: true, displayName: true } },
          sessions: {
            orderBy: { startTime: 'asc' },
            take: 1,
            select: { startTime: true },
          },
          result: true,
        },
      });
      if (!attempt) throw new NotFoundException('Exam attempt not found');
    }
    return attempt;
  }

  private availableSections(exam: {
    _count: { mathQuestions: number };
    passageBundles: Array<{ sectionType: ExamSectionType }>;
  }) {
    return [
      ...(exam._count.mathQuestions > 0 ? [ExamSectionType.MATH] : []),
      ...(exam.passageBundles.some(
        (bundle) => bundle.sectionType === ExamSectionType.READING,
      ) ? [ExamSectionType.READING] : []),
      ...(exam.passageBundles.some(
        (bundle) => bundle.sectionType === ExamSectionType.SCIENCE,
      ) ? [ExamSectionType.SCIENCE] : []),
    ];
  }

  private publicExam(exam: { id: string; title: string; totalPoints: number }) {
    return {
      id: exam.id,
      title: exam.title,
      totalPoints: exam.totalPoints,
    };
  }
}
