import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ExamSectionType,
  Prisma,
  QuestionStatus,
  Tag,
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
  BulkCreateQuestionsDto,
  BulkUpdateQuestionStatusDto,
  CreateTagDto,
  CreateQuestionDto,
  ListQuestionsDto,
  UpdateQuestionDto,
  UpdateQuestionStatusDto,
} from './dto/admin-question.dto';
import {
  CreatePassageBundleDto,
  CreatePassageBundleWithQuestionsDto,
  ListPassageBundlesDto,
  UpdatePassageBundleDto,
} from './dto/passage-bundle.dto';

type QuestionWriteInput = Omit<CreateQuestionDto, 'contentJson' | 'irtParams'> & {
  contentJson: unknown;
  irtParams?: unknown;
};

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listTags() {
    const tags = await this.prisma.tag.findMany({
      orderBy: [{ depth: 'asc' }, { orderIndex: 'asc' }, { name: 'asc' }],
    });

    return this.buildTagTree(tags);
  }

  async createTag(dto: CreateTagDto) {
    let depth = 0;

    if (dto.parentId) {
      const parent = await this.prisma.tag.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Parent tag not found');
      if (parent.depth >= 3) {
        throw new BadRequestException('Tag taxonomy supports depth 0-3 only');
      }
      depth = parent.depth + 1;
    }

    try {
      return await this.prisma.tag.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          parentId: dto.parentId,
          depth,
          orderIndex: dto.orderIndex ?? 0,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Tag slug already exists');
      }
      throw error;
    }
  }

  async createQuestion(dto: CreateQuestionDto, currentUser: User) {
    return this.createQuestionRecord(dto, currentUser);
  }

  async bulkCreateQuestions(dto: BulkCreateQuestionsDto, currentUser: User) {
    const prepared = dto.questions.map((question) => ({
      ...question,
      contentJson: validateQuestionContent(question.contentJson, question.type),
      irtParams: validateIrtParams(question.irtParams),
    }));

    const data = await this.prisma.$transaction((tx) =>
      Promise.all(
        prepared.map((question) => this.createQuestionRecord(question, currentUser, tx)),
      ),
    );

    return {
      createdCount: data.length,
      data,
    };
  }

  private async createQuestionRecord(
    dto: QuestionWriteInput,
    currentUser: User,
    prisma: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const contentJson = validateQuestionContent(dto.contentJson, dto.type);
    const irtParams = validateIrtParams(dto.irtParams);

    return prisma.question.create({
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
      tags: dto.tagId?.length ? { some: { tagId: { in: dto.tagId } } } : undefined,
      bundleQuestion: dto.standaloneOnly ? null : undefined,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        skip: dto.skip,
        take: dto.limit,
        orderBy: this.getQuestionOrderBy(dto.sortBy, dto.sortOrder),
        include: this.questionInclude(),
      }),
      this.prisma.question.count({ where }),
    ]);

    return paginate(data, total, dto);
  }

  async getQuestion(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: this.questionInclude(),
    });
    if (!question) throw new NotFoundException('Question not found');
    return question;
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
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) throw new NotFoundException('Question not found');
    this.assertQuestionStatusTransition(question.status, dto.status);

    return this.prisma.question.update({
      where: { id },
      data: this.questionStatusUpdateData(dto, currentUser),
      include: this.questionInclude(),
    });
  }

  async bulkUpdateQuestionStatus(dto: BulkUpdateQuestionStatusDto, currentUser: User) {
    const questions = await this.prisma.question.findMany({
      where: { id: { in: dto.ids } },
      select: { id: true, status: true },
    });

    if (questions.length !== dto.ids.length) {
      throw new NotFoundException('One or more questions were not found');
    }

    questions.forEach((question) => this.assertQuestionStatusTransition(question.status, dto.status));

    const data = await this.prisma.$transaction(
      dto.ids.map((id) =>
        this.prisma.question.update({
          where: { id },
          data: this.questionStatusUpdateData(dto, currentUser),
          include: this.questionInclude(),
        }),
      ),
    );

    return { updatedCount: data.length, data };
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
        tags: dto.tagIds?.length
          ? { create: dto.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
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

  async createPassageBundleWithQuestions(
    dto: CreatePassageBundleWithQuestionsDto,
    currentUser: User,
  ) {
    this.validateBundleCount(dto.sectionType, dto.questions.length);
    validateRichTextArray(dto.contentJson, 'contentJson');

    return this.prisma.$transaction(async (tx) => {
      const createdQuestions = [];
      for (const question of dto.questions) {
        const createdQuestion = await this.createQuestionRecord(
          {
            ...question,
            status: question.status ?? dto.status ?? QuestionStatus.DRAFT,
            authorId: question.authorId ?? dto.authorId,
            contributionId: question.contributionId ?? dto.contributionId,
            tagIds: undefined,
          },
          currentUser,
          tx,
        );
        createdQuestions.push(createdQuestion);
      }

      return tx.passageBundle.create({
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
          tags: dto.tagIds?.length
            ? { create: dto.tagIds.map((tagId) => ({ tagId })) }
            : undefined,
          questions: {
            create: createdQuestions.map((question, index) => ({
              questionId: question.id,
              orderInBundle: index + 1,
              points: dto.questions[index].points ?? 1,
            })),
          },
        },
        include: this.bundleInclude(),
      });
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

  async getPassageBundle(id: string) {
    const bundle = await this.prisma.passageBundle.findUnique({
      where: { id },
      include: this.bundleInclude(),
    });
    if (!bundle) throw new NotFoundException('Passage bundle not found');
    return bundle;
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
      if (dto.tagIds !== undefined) {
        await tx.passageBundleTag.deleteMany({ where: { bundleId: id } });
        if (dto.tagIds.length > 0) {
          await tx.passageBundleTag.createMany({
            data: dto.tagIds.map((tagId) => ({ bundleId: id, tagId })),
            skipDuplicates: true,
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

    this.validateBundleCount(sectionType, questions.length);

    const orders = new Set(questions.map((question) => question.orderInBundle));
    if (orders.size !== questions.length) {
      throw new BadRequestException('orderInBundle values must be unique');
    }
  }

  private validateBundleCount(sectionType: ExamSectionType, count: number) {
    if (sectionType === ExamSectionType.MATH) {
      throw new BadRequestException('Passage bundles only support READING or SCIENCE');
    }

    const expectedCount = sectionType === ExamSectionType.READING ? 10 : 5;
    if (count !== expectedCount) {
      throw new BadRequestException(`${sectionType} bundle must contain exactly ${expectedCount} questions`);
    }
  }

  private buildTagTree(tags: Tag[]) {
    type TagNode = Tag & { children: TagNode[] };
    const nodes = new Map<string, TagNode>();
    const roots: TagNode[] = [];

    tags.forEach((tag) => nodes.set(tag.id, { ...tag, children: [] }));
    nodes.forEach((node) => {
      if (node.parentId) {
        const parent = nodes.get(node.parentId);
        if (parent) parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortNodes = (items: TagNode[]) => {
      items.sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name));
      items.forEach((item) => sortNodes(item.children));
    };
    sortNodes(roots);

    return roots;
  }

  private getQuestionOrderBy(
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Prisma.QuestionOrderByWithRelationInput {
    const allowed = new Set(['createdAt', 'updatedAt', 'expectedTimeSecs', 'level', 'type', 'status']);
    if (!sortBy || !allowed.has(sortBy)) {
      return { createdAt: 'desc' };
    }

    return { [sortBy]: sortOrder };
  }

  private questionStatusUpdateData(dto: UpdateQuestionStatusDto, currentUser: User): Prisma.QuestionUpdateInput {
    return {
      status: dto.status,
      reviewNote: dto.reviewNote,
      reviewedBy: dto.status === QuestionStatus.PUBLISHED || dto.status === QuestionStatus.ARCHIVED
        ? { connect: { id: currentUser.id } }
        : undefined,
      publishedAt: dto.status === QuestionStatus.PUBLISHED ? new Date() : null,
    };
  }

  private assertQuestionStatusTransition(from: QuestionStatus, to: QuestionStatus) {
    if (from === to) return;
    const allowed: Record<QuestionStatus, QuestionStatus[]> = {
      [QuestionStatus.DRAFT]: [QuestionStatus.PENDING_REVIEW, QuestionStatus.PUBLISHED, QuestionStatus.ARCHIVED],
      [QuestionStatus.PENDING_REVIEW]: [QuestionStatus.PUBLISHED, QuestionStatus.ARCHIVED, QuestionStatus.DRAFT],
      [QuestionStatus.PUBLISHED]: [QuestionStatus.ARCHIVED, QuestionStatus.DRAFT],
      [QuestionStatus.ARCHIVED]: [QuestionStatus.DRAFT],
    };

    if (!allowed[from].includes(to)) {
      throw new BadRequestException(`Cannot move question from ${from} to ${to}`);
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
      tags: { include: { tag: true } },
      questions: {
        orderBy: { orderInBundle: 'asc' as const },
        include: { question: { include: this.questionInclude() } },
      },
    };
  }
}
