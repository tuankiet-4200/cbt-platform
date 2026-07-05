import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ExamSectionType,
  Prisma,
  QuestionStatus,
  User,
} from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { paginate } from '@/common/dto/pagination.dto';
import {
  validateIrtParams,
  validateQuestionContent,
  validateRichTextArray,
} from './question-content.validator';
import {
  CreateQuestionDto,
  ListQuestionsDto,
  UpdateQuestionDto,
  UpdateQuestionStatusDto,
} from './dto/admin-question.dto';
import {
  CreatePassageBundleDto,
  ListPassageBundlesDto,
  UpdatePassageBundleDto,
} from './dto/passage-bundle.dto';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createQuestion(dto: CreateQuestionDto, currentUser: User) {
    const contentJson = validateQuestionContent(dto.contentJson, dto.type);
    const irtParams = validateIrtParams(dto.irtParams);

    return this.prisma.question.create({
      data: {
        type: dto.type,
        status: dto.status ?? QuestionStatus.DRAFT,
        level: dto.level,
        contentJson: contentJson as Prisma.InputJsonValue,
        irtParams: irtParams as unknown as Prisma.InputJsonValue,
        expectedTimeSecs: dto.expectedTimeSecs,
        authorId: dto.authorId ?? currentUser.id,
        contributionId: dto.contributionId,
        ...(dto.status === QuestionStatus.PUBLISHED
          ? { reviewedById: currentUser.id, publishedAt: new Date() }
          : {}),
        tags: dto.tagIds?.length
          ? { create: dto.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
      include: this.questionInclude(),
    });
  }

  async listQuestions(dto: ListQuestionsDto) {
    const where: Prisma.QuestionWhereInput = {
      type: dto.type,
      level: dto.level,
      status: dto.status,
      tags: dto.tagId ? { some: { tagId: dto.tagId } } : undefined,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        skip: dto.skip,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
        include: this.questionInclude(),
      }),
      this.prisma.question.count({ where }),
    ]);

    return paginate(data, total, dto);
  }

  async updateQuestion(id: string, dto: UpdateQuestionDto) {
    const existing = await this.prisma.question.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Question not found');

    const type = dto.type ?? existing.type;
    const data: Prisma.QuestionUpdateInput = {
      type: dto.type,
      level: dto.level,
      expectedTimeSecs: dto.expectedTimeSecs,
      reviewNote: dto.reviewNote,
    };

    if (dto.contentJson !== undefined) {
      data.contentJson = validateQuestionContent(dto.contentJson, type) as Prisma.InputJsonValue;
    }
    if (dto.irtParams !== undefined) {
      data.irtParams = validateIrtParams(dto.irtParams) as unknown as Prisma.InputJsonValue;
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.tagIds !== undefined) {
        await tx.questionTag.deleteMany({ where: { questionId: id } });
        if (dto.tagIds.length > 0) {
          await tx.questionTag.createMany({
            data: dto.tagIds.map((tagId) => ({ questionId: id, tagId })),
            skipDuplicates: true,
          });
        }
      }

      return tx.question.update({
        where: { id },
        data,
        include: this.questionInclude(),
      });
    });
  }

  async deleteQuestion(id: string) {
    await this.prisma.question.delete({ where: { id } });
    return { ok: true };
  }

  async updateQuestionStatus(id: string, dto: UpdateQuestionStatusDto, currentUser: User) {
    return this.prisma.question.update({
      where: { id },
      data: {
        status: dto.status,
        reviewNote: dto.reviewNote,
        reviewedById: dto.status === QuestionStatus.PUBLISHED || dto.status === QuestionStatus.ARCHIVED
          ? currentUser.id
          : undefined,
        publishedAt: dto.status === QuestionStatus.PUBLISHED ? new Date() : undefined,
      },
      include: this.questionInclude(),
    });
  }

  async createPassageBundle(dto: CreatePassageBundleDto, currentUser: User) {
    this.validateBundle(dto.sectionType, dto.questions);
    validateRichTextArray(dto.contentJson, 'contentJson');

    return this.prisma.passageBundle.create({
      data: {
        sectionType: dto.sectionType,
        title: dto.title,
        contentJson: dto.contentJson as Prisma.InputJsonValue,
        expectedTimeSecs: dto.expectedTimeSecs,
        status: dto.status ?? QuestionStatus.DRAFT,
        authorId: dto.authorId ?? currentUser.id,
        contributionId: dto.contributionId,
        ...(dto.status === QuestionStatus.PUBLISHED
          ? { reviewedById: currentUser.id, publishedAt: new Date() }
          : {}),
        questions: {
          create: dto.questions.map((question) => ({
            questionId: question.questionId,
            orderInBundle: question.orderInBundle,
            points: question.points ?? 1,
          })),
        },
      },
      include: this.bundleInclude(),
    });
  }

  async listPassageBundles(dto: ListPassageBundlesDto) {
    const where: Prisma.PassageBundleWhereInput = {
      sectionType: dto.sectionType,
      status: dto.status,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.passageBundle.findMany({
        where,
        skip: dto.skip,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
        include: this.bundleInclude(),
      }),
      this.prisma.passageBundle.count({ where }),
    ]);

    return paginate(data, total, dto);
  }

  async updatePassageBundle(id: string, dto: UpdatePassageBundleDto) {
    const existing = await this.prisma.passageBundle.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Passage bundle not found');

    if (dto.questions !== undefined) {
      this.validateBundle(existing.sectionType, dto.questions);
    }
    if (dto.contentJson !== undefined) {
      validateRichTextArray(dto.contentJson, 'contentJson');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.questions !== undefined) {
        await tx.passageBundleQuestion.deleteMany({ where: { bundleId: id } });
        if (dto.questions.length > 0) {
          await tx.passageBundleQuestion.createMany({
            data: dto.questions.map((question) => ({
              bundleId: id,
              questionId: question.questionId,
              orderInBundle: question.orderInBundle,
              points: question.points ?? 1,
            })),
          });
        }
      }

      return tx.passageBundle.update({
        where: { id },
        data: {
          title: dto.title,
          contentJson: dto.contentJson as Prisma.InputJsonValue | undefined,
          expectedTimeSecs: dto.expectedTimeSecs,
          status: dto.status,
          publishedAt: dto.status === QuestionStatus.PUBLISHED ? new Date() : undefined,
        },
        include: this.bundleInclude(),
      });
    });
  }

  private validateBundle(
    sectionType: ExamSectionType,
    questions: Array<{ questionId: string; orderInBundle: number }>,
  ) {
    if (sectionType === ExamSectionType.MATH) {
      throw new BadRequestException('Passage bundles only support READING or SCIENCE');
    }

    const expectedCount = sectionType === ExamSectionType.READING ? 10 : 5;
    if (questions.length !== expectedCount) {
      throw new BadRequestException(`${sectionType} bundle must contain exactly ${expectedCount} questions`);
    }

    const orders = new Set(questions.map((question) => question.orderInBundle));
    if (orders.size !== questions.length) {
      throw new BadRequestException('orderInBundle values must be unique');
    }
  }

  private questionInclude() {
    return {
      author: { select: { id: true, email: true, displayName: true } },
      reviewedBy: { select: { id: true, email: true, displayName: true } },
      tags: { include: { tag: true } },
      bundleQuestion: true,
    };
  }

  private bundleInclude() {
    return {
      author: { select: { id: true, email: true, displayName: true } },
      reviewedBy: { select: { id: true, email: true, displayName: true } },
      questions: {
        orderBy: { orderInBundle: 'asc' as const },
        include: { question: true },
      },
    };
  }
}

