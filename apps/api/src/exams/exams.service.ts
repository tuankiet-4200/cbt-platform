import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CognitiveLevel,
  ExamAccessType,
  ExamBlueprintStatus,
  ExamSectionType,
  Prisma,
  QuestionStatus,
  QuestionType,
} from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  CreateExamBlueprintDto,
  CreateExamDto,
  GenerateExamDto,
  UpdateExamBlueprintTemplateDto,
  UpdateExamSettingsDto,
} from './dto/exam-generation.dto';

type SectionType = 'MATH' | 'READING' | 'SCIENCE';
type UnitType = 'question' | 'bundle';

interface TagRule {
  tagId?: string;
  tagSlug?: string;
  count?: number;
}

interface ChildTagRule {
  tagId?: string;
  tagSlug?: string;
  min?: number;
  max?: number;
}

interface DifficultyRule {
  level: CognitiveLevel;
  count?: number;
  percent?: number;
  min?: number;
  max?: number;
}

interface QuestionTypeRule {
  type: QuestionType;
  count?: number;
  percent?: number;
  min?: number;
  max?: number;
}

interface SectionBlueprint {
  sectionType: SectionType;
  targetQuestionCount?: number;
  targetBundleCount?: number;
  rootTagRules?: TagRule[];
  childTagRules?: ChildTagRule[];
  difficultyRules?: DifficultyRule[];
  questionTypeRules?: QuestionTypeRule[];
}

interface ExamBlueprint {
  version: 1;
  durationMins?: number;
  sections: SectionBlueprint[];
  randomization?: {
    seed?: string;
    maxAttempts?: number;
  };
}

interface Shortage {
  section: SectionType;
  constraint: string;
  required: number;
  available: number;
  unit: UnitType | 'question-level';
}

interface MathCandidate {
  id: string;
  level: CognitiveLevel;
  type: QuestionType;
  tagIds: Set<string>;
}

interface BundleCandidate {
  id: string;
  sectionType: Exclude<SectionType, 'MATH'>;
  questionCount: number;
  points: number;
  levelCounts: Record<CognitiveLevel, number>;
  tagIds: Set<string>;
}

interface CandidatePools {
  tags: Awaited<ReturnType<PrismaService['tag']['findMany']>>;
  math: MathCandidate[];
  reading: BundleCandidate[];
  science: BundleCandidate[];
}

interface Selection {
  math: MathCandidate[];
  reading: BundleCandidate[];
  science: BundleCandidate[];
}

const DEFAULT_BLUEPRINT: ExamBlueprint = {
  version: 1,
  durationMins: 150,
  sections: [
    {
      sectionType: 'MATH',
      targetQuestionCount: 50,
    },
    {
      sectionType: 'READING',
      targetBundleCount: 2,
      targetQuestionCount: 20,
    },
    {
      sectionType: 'SCIENCE',
      targetBundleCount: 3,
      targetQuestionCount: 15,
    },
  ],
};

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  async listExams() {
    const exams = await this.prisma.exam.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        blueprint: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            mathQuestions: true,
            passageBundles: true,
            sessions: true,
            accessCodes: true,
          },
        },
        passageBundles: {
          select: {
            sectionType: true,
            passageBundle: {
              select: {
                questions: { select: { questionId: true } },
              },
            },
          },
        },
      },
    });

    return exams.map((exam) => ({
      id: exam.id,
      title: exam.title,
      description: exam.description,
      durationMins: exam.durationMins,
      totalPoints: exam.totalPoints,
      accessType: exam.accessType,
      isPublished: exam.isPublished,
      blueprintJson: exam.blueprintJson,
      blueprintId: exam.blueprintId,
      blueprint: exam.blueprint,
      generationSeed: exam.generationSeed,
      generatedAt: exam.generatedAt,
      createdAt: exam.createdAt,
      updatedAt: exam.updatedAt,
      counts: {
        mathQuestions: exam._count.mathQuestions,
        readingBundles: exam.passageBundles.filter((item) => item.sectionType === ExamSectionType.READING).length,
        readingQuestions: exam.passageBundles
          .filter((item) => item.sectionType === ExamSectionType.READING)
          .reduce((sum, item) => sum + item.passageBundle.questions.length, 0),
        scienceBundles: exam.passageBundles.filter((item) => item.sectionType === ExamSectionType.SCIENCE).length,
        scienceQuestions: exam.passageBundles
          .filter((item) => item.sectionType === ExamSectionType.SCIENCE)
          .reduce((sum, item) => sum + item.passageBundle.questions.length, 0),
        sessions: exam._count.sessions,
        accessCodes: exam._count.accessCodes,
      },
    }));
  }

  async listExamBlueprints() {
    const blueprints = await this.prisma.examBlueprint.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
        _count: {
          select: {
            exams: true,
          },
        },
      },
    });

    return blueprints.map((blueprint) => ({
      id: blueprint.id,
      name: blueprint.name,
      description: blueprint.description,
      durationMins: blueprint.durationMins,
      status: blueprint.status,
      blueprintJson: blueprint.blueprintJson,
      createdBy: blueprint.createdBy,
      createdAt: blueprint.createdAt,
      updatedAt: blueprint.updatedAt,
      counts: {
        exams: blueprint._count.exams,
      },
    }));
  }

  async createExamBlueprint(dto: CreateExamBlueprintDto, createdById?: string) {
    const blueprint = this.normalizeBlueprint(dto.blueprintJson);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Blueprint name cannot be empty');

    return this.prisma.examBlueprint.create({
      data: {
        name,
        description: dto.description?.trim() || null,
        durationMins: dto.durationMins ?? blueprint.durationMins ?? 150,
        status: dto.status ?? ExamBlueprintStatus.ACTIVE,
        blueprintJson: blueprint as unknown as Prisma.InputJsonValue,
        createdById,
      },
    });
  }

  async updateExamBlueprintTemplate(id: string, dto: UpdateExamBlueprintTemplateDto) {
    await this.assertExamBlueprintExists(id);
    const data: Prisma.ExamBlueprintUpdateInput = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Blueprint name cannot be empty');
      data.name = name;
    }
    if (dto.description !== undefined) data.description = dto.description.trim() || null;
    if (dto.status !== undefined) data.status = dto.status;

    if (dto.blueprintJson !== undefined) {
      const blueprint = this.normalizeBlueprint(dto.blueprintJson);
      data.blueprintJson = blueprint as unknown as Prisma.InputJsonValue;
      data.durationMins = dto.durationMins ?? blueprint.durationMins ?? 150;
    } else if (dto.durationMins !== undefined) {
      data.durationMins = dto.durationMins;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No blueprint fields provided');
    }

    return this.prisma.examBlueprint.update({
      where: { id },
      data,
    });
  }

  async checkExamBlueprintTemplateAvailability(id: string) {
    const blueprintTemplate = await this.getExamBlueprint(id);
    const blueprint = this.normalizeBlueprint(blueprintTemplate.blueprintJson as Record<string, unknown>);
    const pools = await this.buildCandidatePools();
    return this.buildAvailabilityReport(blueprint, pools);
  }

  async createExam(dto: CreateExamDto) {
    const blueprintTemplate = dto.blueprintId
      ? await this.getUsableExamBlueprint(dto.blueprintId)
      : null;
    const blueprint = blueprintTemplate
      ? this.normalizeBlueprint(blueprintTemplate.blueprintJson as Record<string, unknown>)
      : dto.blueprintJson
        ? this.normalizeBlueprint(dto.blueprintJson)
        : DEFAULT_BLUEPRINT;

    return this.prisma.exam.create({
      data: {
        title: dto.title,
        description: dto.description,
        instructions: dto.instructions,
        durationMins: dto.durationMins ?? blueprint.durationMins ?? 150,
        accessType: dto.accessType ?? ExamAccessType.LOCKED,
        blueprintId: blueprintTemplate?.id,
        blueprintJson: blueprint as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async updateSettings(examId: string, dto: UpdateExamSettingsDto) {
    await this.assertExamExists(examId);

    const data: Prisma.ExamUpdateInput = {};
    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title) throw new BadRequestException('Exam title cannot be empty');
      data.title = title;
    }
    if (dto.description !== undefined) {
      data.description = dto.description.trim() || null;
    }
    if (dto.accessType !== undefined) {
      data.accessType = dto.accessType;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No exam settings provided');
    }

    return this.prisma.exam.update({
      where: { id: examId },
      data,
    });
  }

  async updateBlueprint(examId: string, rawBlueprint: Record<string, unknown>) {
    await this.assertExamExists(examId);
    const blueprint = this.normalizeBlueprint(rawBlueprint);
    return this.prisma.exam.update({
      where: { id: examId },
      data: {
        blueprintJson: blueprint as unknown as Prisma.InputJsonValue,
        blueprintId: null,
        durationMins: blueprint.durationMins,
        isPublished: false,
      },
    });
  }

  async checkBlueprintAvailability(rawBlueprint: Record<string, unknown>) {
    const blueprint = this.normalizeBlueprint(rawBlueprint);
    const pools = await this.buildCandidatePools();
    return this.buildAvailabilityReport(blueprint, pools);
  }

  async checkExamAvailability(examId: string) {
    const exam = await this.getExamWithBlueprint(examId);
    const blueprint = this.normalizeBlueprint((exam.blueprintJson ?? DEFAULT_BLUEPRINT) as Record<string, unknown>);
    const pools = await this.buildCandidatePools();
    return this.buildAvailabilityReport(blueprint, pools);
  }

  async generateDraft(examId: string, dto: GenerateExamDto) {
    const exam = await this.getExamWithBlueprint(examId);
    const blueprint = this.normalizeBlueprint((exam.blueprintJson ?? DEFAULT_BLUEPRINT) as Record<string, unknown>);
    const pools = await this.buildCandidatePools();
    const availability = this.buildAvailabilityReport(blueprint, pools);

    if (!availability.ok) {
      return {
        ok: false,
        seed: dto.seed ?? blueprint.randomization?.seed ?? `${examId}:0`,
        shortages: availability.shortages,
      };
    }

    const maxAttempts = dto.maxAttempts ?? blueprint.randomization?.maxAttempts ?? 5;
    const baseSeed = dto.seed ?? blueprint.randomization?.seed ?? `${examId}:${Date.now()}`;
    let lastValidation: ReturnType<typeof this.validateSelection> | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const seed = `${baseSeed}:${attempt}`;
      const rng = createSeededRandom(seed);
      const selection = this.sampleBlueprint(blueprint, pools, rng);
      const validation = this.validateSelection(blueprint, selection, pools);
      lastValidation = validation;

      if (!validation.ok) continue;

      await this.persistGeneratedDraft(examId, blueprint, selection, seed);
      return {
        ok: true,
        seed,
        preview: await this.previewExam(examId),
      };
    }

    return {
      ok: false,
      seed: baseSeed,
      shortages: lastValidation?.shortages ?? [],
    };
  }

  async previewExam(examId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        mathQuestions: {
          orderBy: { orderInSection: 'asc' },
          include: {
            question: {
              include: { tags: { include: { tag: true } } },
            },
          },
        },
        passageBundles: {
          orderBy: [{ sectionType: 'asc' }, { orderInSection: 'asc' }],
          include: {
            passageBundle: {
              include: {
                tags: { include: { tag: true } },
                questions: {
                  orderBy: { orderInBundle: 'asc' },
                  include: {
                    question: {
                      include: { tags: { include: { tag: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const readingBundles = exam.passageBundles.filter((item) => item.sectionType === ExamSectionType.READING);
    const scienceBundles = exam.passageBundles.filter((item) => item.sectionType === ExamSectionType.SCIENCE);

    return {
      id: exam.id,
      title: exam.title,
      durationMins: exam.durationMins,
      accessType: exam.accessType,
      isPublished: exam.isPublished,
      totalPoints: exam.totalPoints,
      generationSeed: exam.generationSeed,
      generatedAt: exam.generatedAt,
      blueprintJson: exam.blueprintJson,
      sections: {
        MATH: {
          questionCount: exam.mathQuestions.length,
          itemCount: exam.mathQuestions.length,
          difficulty: countByLevel(exam.mathQuestions.map((item) => item.question.level)),
          items: exam.mathQuestions.map((item) => ({
            id: item.questionId,
            order: item.orderInSection,
            points: item.points,
            type: item.question.type,
            level: item.question.level,
            tags: item.question.tags.map((tag) => ({
              id: tag.tag.id,
              name: tag.tag.name,
              slug: tag.tag.slug,
            })),
            snippet: contentSnippet(item.question.contentJson),
          })),
        },
        READING: this.bundlePreview(readingBundles),
        SCIENCE: this.bundlePreview(scienceBundles),
      },
    };
  }

  async setPublishState(examId: string, isPublished: boolean) {
    if (isPublished) {
      const preview = await this.previewExam(examId);
      const blueprint = this.normalizeBlueprint((preview.blueprintJson ?? DEFAULT_BLUEPRINT) as Record<string, unknown>);
      const pools = await this.buildCandidatePools();
      const selection = await this.selectionFromPersistedExam(examId, pools);
      const validation = this.validateSelection(blueprint, selection, pools);
      if (!validation.ok) {
        throw new BadRequestException({
          message: 'Generated exam does not satisfy blueprint constraints',
          shortages: validation.shortages,
        });
      }
    }

    return this.prisma.exam.update({
      where: { id: examId },
      data: { isPublished },
    });
  }

  private async assertExamExists(examId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId }, select: { id: true } });
    if (!exam) throw new NotFoundException('Exam not found');
  }

  private async assertExamBlueprintExists(id: string) {
    const blueprint = await this.prisma.examBlueprint.findUnique({ where: { id }, select: { id: true } });
    if (!blueprint) throw new NotFoundException('Exam blueprint not found');
  }

  private async getExamWithBlueprint(examId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Exam not found');
    return exam;
  }

  private async getExamBlueprint(id: string) {
    const blueprint = await this.prisma.examBlueprint.findUnique({ where: { id } });
    if (!blueprint) throw new NotFoundException('Exam blueprint not found');
    return blueprint;
  }

  private async getUsableExamBlueprint(id: string) {
    const blueprint = await this.getExamBlueprint(id);
    if (blueprint.status === ExamBlueprintStatus.ARCHIVED) {
      throw new BadRequestException('Archived blueprint cannot be used to create exams');
    }
    return blueprint;
  }

  private normalizeBlueprint(raw: Record<string, unknown>): ExamBlueprint {
    const source = Object.keys(raw).length === 0 ? DEFAULT_BLUEPRINT : raw;
    const sectionsRaw = Array.isArray(source.sections) ? source.sections : DEFAULT_BLUEPRINT.sections;

    const sections = sectionsRaw.map((section): SectionBlueprint => {
      if (!isRecord(section)) throw new BadRequestException('Invalid blueprint section');
      const sectionType = parseSectionType(section.sectionType);
      const defaultSection = DEFAULT_BLUEPRINT.sections.find((item) => item.sectionType === sectionType);
      const targetBundleCount = numberOrUndefined(section.targetBundleCount) ?? defaultSection?.targetBundleCount;
      const targetQuestionCount = numberOrUndefined(section.targetQuestionCount) ?? defaultSection?.targetQuestionCount;

      return {
        sectionType,
        targetQuestionCount,
        targetBundleCount,
        rootTagRules: parseTagRules(section.rootTagRules),
        childTagRules: parseChildTagRules(section.childTagRules),
        difficultyRules: parseDifficultyRules(section.difficultyRules),
        questionTypeRules: sectionType === 'MATH' ? parseQuestionTypeRules(section.questionTypeRules) : [],
      };
    });

    for (const required of ['MATH', 'READING', 'SCIENCE'] satisfies SectionType[]) {
      if (!sections.some((section) => section.sectionType === required)) {
        const defaultSection = DEFAULT_BLUEPRINT.sections.find((item) => item.sectionType === required);
        if (defaultSection) sections.push(defaultSection);
      }
    }

    return {
      version: 1,
      durationMins: numberOrUndefined(source.durationMins) ?? DEFAULT_BLUEPRINT.durationMins,
      sections,
      randomization: isRecord(source.randomization)
        ? {
            seed: typeof source.randomization.seed === 'string' ? source.randomization.seed : undefined,
            maxAttempts: numberOrUndefined(source.randomization.maxAttempts),
          }
        : undefined,
    };
  }

  private async buildCandidatePools(): Promise<CandidatePools> {
    const [tags, questions, bundles] = await this.prisma.$transaction([
      this.prisma.tag.findMany(),
      this.prisma.question.findMany({
        where: {
          status: QuestionStatus.PUBLISHED,
          bundleQuestion: null,
        },
        include: { tags: true },
      }),
      this.prisma.passageBundle.findMany({
        where: {
          status: QuestionStatus.PUBLISHED,
          sectionType: { in: [ExamSectionType.READING, ExamSectionType.SCIENCE] },
        },
        include: {
          tags: true,
          questions: {
            include: { question: true },
          },
        },
      }),
    ]);

    const math = questions.map((question) => ({
      id: question.id,
      level: question.level,
      type: question.type,
      tagIds: new Set(question.tags.map((tag) => tag.tagId)),
    }));

    const bundleCandidates = bundles
      .map((bundle): BundleCandidate => ({
        id: bundle.id,
        sectionType: bundle.sectionType as Exclude<SectionType, 'MATH'>,
        questionCount: bundle.questions.length,
        points: bundle.questions.reduce((sum, item) => sum + item.points, 0),
        levelCounts: countByLevel(bundle.questions.map((item) => item.question.level)),
        tagIds: new Set(bundle.tags.map((tag) => tag.tagId)),
      }))
      .filter((bundle) =>
        bundle.sectionType === 'READING'
          ? bundle.questionCount === 10
          : bundle.questionCount === 5,
      );

    return {
      tags,
      math,
      reading: bundleCandidates.filter((bundle) => bundle.sectionType === 'READING'),
      science: bundleCandidates.filter((bundle) => bundle.sectionType === 'SCIENCE'),
    };
  }

  private buildAvailabilityReport(blueprint: ExamBlueprint, pools: CandidatePools) {
    const shortages: Shortage[] = [];

    for (const section of blueprint.sections) {
      const sectionPool = this.poolForSection(section.sectionType, pools);
      const unit: UnitType = section.sectionType === 'MATH' ? 'question' : 'bundle';
      const requiredUnits = this.requiredUnits(section);

      if (sectionPool.length < requiredUnits) {
        shortages.push({
          section: section.sectionType,
          constraint: 'total published candidate pool',
          required: requiredUnits,
          available: sectionPool.length,
          unit,
        });
      }

      for (const rule of section.rootTagRules ?? []) {
        const tagIds = this.resolveTagRule(rule, section.sectionType, pools.tags);
        const available = sectionPool.filter((item) => intersects(item.tagIds, tagIds)).length;
        const required = rule.count ?? 0;
        if (required > 0 && available < required) {
          shortages.push({
            section: section.sectionType,
            constraint: `root tag ${rule.tagSlug ?? rule.tagId}`,
            required,
            available,
            unit,
          });
        }
      }

      for (const rule of section.childTagRules ?? []) {
        const tagIds = this.resolveTagRule(rule, section.sectionType, pools.tags);
        const available = sectionPool.filter((item) => intersects(item.tagIds, tagIds)).length;
        const required = rule.min ?? 0;
        if (required > 0 && available < required) {
          shortages.push({
            section: section.sectionType,
            constraint: `child tag ${rule.tagSlug ?? rule.tagId}`,
            required,
            available,
            unit,
          });
        }
      }

      for (const rule of section.difficultyRules ?? []) {
        const required = this.resolveRuleCount(rule, section.targetQuestionCount ?? requiredUnits);
        const available = this.availableLevelCount(section.sectionType, sectionPool, rule.level);
        if (required > 0 && available < required) {
          shortages.push({
            section: section.sectionType,
            constraint: `difficulty ${rule.level}`,
            required,
            available,
            unit: 'question-level',
          });
        }
      }
    }

    return {
      ok: shortages.length === 0,
      shortages,
      candidateCounts: {
        MATH: pools.math.length,
        READING: pools.reading.length,
        SCIENCE: pools.science.length,
      },
    };
  }

  private sampleBlueprint(
    blueprint: ExamBlueprint,
    pools: CandidatePools,
    rng: () => number,
  ): Selection {
    const selection: Selection = { math: [], reading: [], science: [] };

    for (const section of blueprint.sections) {
      const pool = this.poolForSection(section.sectionType, pools);
      const selected = this.sampleSection(section, pool, pools.tags, rng);
      if (section.sectionType === 'MATH') selection.math = selected as MathCandidate[];
      if (section.sectionType === 'READING') selection.reading = selected as BundleCandidate[];
      if (section.sectionType === 'SCIENCE') selection.science = selected as BundleCandidate[];
    }

    return selection;
  }

  private sampleSection(
    section: SectionBlueprint,
    pool: Array<MathCandidate | BundleCandidate>,
    tags: CandidatePools['tags'],
    rng: () => number,
  ) {
    const target = this.requiredUnits(section);
    const selected = new Map<string, MathCandidate | BundleCandidate>();

    for (const rule of section.rootTagRules ?? []) {
      const required = rule.count ?? 0;
      if (required <= 0) continue;
      const tagIds = this.resolveTagRule(rule, section.sectionType, tags);
      const candidates = shuffle(
        pool.filter((item) => intersects(item.tagIds, tagIds) && !selected.has(item.id)),
        rng,
      );
      candidates.slice(0, required).forEach((item) => selected.set(item.id, item));
    }

    const remaining = Math.max(0, target - selected.size);
    if (remaining > 0) {
      const candidates = shuffle(pool.filter((item) => !selected.has(item.id)), rng);
      candidates.slice(0, remaining).forEach((item) => selected.set(item.id, item));
    }

    return shuffle([...selected.values()], rng).slice(0, target);
  }

  private validateSelection(
    blueprint: ExamBlueprint,
    selection: Selection,
    pools: CandidatePools,
  ) {
    const shortages: Shortage[] = [];

    for (const section of blueprint.sections) {
      const selected = this.selectionForSection(section.sectionType, selection);
      const requiredUnits = this.requiredUnits(section);
      const unit: UnitType = section.sectionType === 'MATH' ? 'question' : 'bundle';

      if (selected.length < requiredUnits) {
        shortages.push({
          section: section.sectionType,
          constraint: 'selected total',
          required: requiredUnits,
          available: selected.length,
          unit,
        });
      }

      for (const rule of section.childTagRules ?? []) {
        const tagIds = this.resolveTagRule(rule, section.sectionType, pools.tags);
        const count = selected.filter((item) => intersects(item.tagIds, tagIds)).length;
        if (rule.min !== undefined && count < rule.min) {
          shortages.push({
            section: section.sectionType,
            constraint: `child tag min ${rule.tagSlug ?? rule.tagId}`,
            required: rule.min,
            available: count,
            unit,
          });
        }
        if (rule.max !== undefined && count > rule.max) {
          shortages.push({
            section: section.sectionType,
            constraint: `child tag max ${rule.tagSlug ?? rule.tagId}`,
            required: rule.max,
            available: count,
            unit,
          });
        }
      }

      for (const rule of section.difficultyRules ?? []) {
        const levelCount = this.selectedLevelCount(section.sectionType, selected, rule.level);
        const required = rule.min ?? this.resolveRuleCount(rule, section.targetQuestionCount ?? requiredUnits);
        if (required > 0 && levelCount < required) {
          shortages.push({
            section: section.sectionType,
            constraint: `difficulty ${rule.level}`,
            required,
            available: levelCount,
            unit: 'question-level',
          });
        }
        if (rule.max !== undefined && levelCount > rule.max) {
          shortages.push({
            section: section.sectionType,
            constraint: `difficulty max ${rule.level}`,
            required: rule.max,
            available: levelCount,
            unit: 'question-level',
          });
        }
      }
    }

    return { ok: shortages.length === 0, shortages };
  }

  private async persistGeneratedDraft(
    examId: string,
    blueprint: ExamBlueprint,
    selection: Selection,
    seed: string,
  ) {
    const totalPoints =
      selection.math.length +
      [...selection.reading, ...selection.science].reduce((sum, bundle) => sum + bundle.points, 0);

    await this.prisma.$transaction(async (tx) => {
      await tx.examMathQuestion.deleteMany({ where: { examId } });
      await tx.examPassageBundle.deleteMany({ where: { examId } });

      if (selection.math.length > 0) {
        await tx.examMathQuestion.createMany({
          data: selection.math.map((question, index) => ({
            examId,
            questionId: question.id,
            orderInSection: index,
            points: 1,
          })),
        });
      }

      const passageBundleRows = [
        ...selection.reading.map((bundle, index) => ({
          examId,
          passageBundleId: bundle.id,
          sectionType: ExamSectionType.READING,
          orderInSection: index,
        })),
        ...selection.science.map((bundle, index) => ({
          examId,
          passageBundleId: bundle.id,
          sectionType: ExamSectionType.SCIENCE,
          orderInSection: index,
        })),
      ];

      if (passageBundleRows.length > 0) {
        await tx.examPassageBundle.createMany({ data: passageBundleRows });
      }

      await tx.exam.update({
        where: { id: examId },
        data: {
          blueprintJson: blueprint as unknown as Prisma.InputJsonValue,
          durationMins: blueprint.durationMins ?? 150,
          totalPoints,
          isPublished: false,
          generationSeed: seed,
          generatedAt: new Date(),
        },
      });
    });
  }

  private async selectionFromPersistedExam(examId: string, pools: CandidatePools): Promise<Selection> {
    const [mathRows, bundleRows] = await this.prisma.$transaction([
      this.prisma.examMathQuestion.findMany({ where: { examId }, select: { questionId: true } }),
      this.prisma.examPassageBundle.findMany({ where: { examId }, select: { passageBundleId: true, sectionType: true } }),
    ]);

    return {
      math: mathRows
        .map((row) => pools.math.find((item) => item.id === row.questionId))
        .filter((item): item is MathCandidate => Boolean(item)),
      reading: bundleRows
        .filter((row) => row.sectionType === ExamSectionType.READING)
        .map((row) => pools.reading.find((item) => item.id === row.passageBundleId))
        .filter((item): item is BundleCandidate => Boolean(item)),
      science: bundleRows
        .filter((row) => row.sectionType === ExamSectionType.SCIENCE)
        .map((row) => pools.science.find((item) => item.id === row.passageBundleId))
        .filter((item): item is BundleCandidate => Boolean(item)),
    };
  }

  private bundlePreview(items: Array<{
    orderInSection: number;
    passageBundle: {
      id: string;
      title: string | null;
      contentJson: Prisma.JsonValue;
      tags: Array<{ tag: { id: string; name: string; slug: string } }>;
      questions: Array<{
        question: {
          id: string;
          type: QuestionType;
          level: CognitiveLevel;
          contentJson: Prisma.JsonValue;
        };
      }>;
    };
  }>) {
    const levels = items.flatMap((item) => item.passageBundle.questions.map((question) => question.question.level));
    return {
      bundleCount: items.length,
      questionCount: levels.length,
      itemCount: items.length,
      difficulty: countByLevel(levels),
      bundles: items.map((item) => ({
        id: item.passageBundle.id,
        order: item.orderInSection,
        title: item.passageBundle.title,
        tags: item.passageBundle.tags.map((tag) => ({
          id: tag.tag.id,
          name: tag.tag.name,
          slug: tag.tag.slug,
        })),
        snippet: contentSnippet(item.passageBundle.contentJson),
        questions: item.passageBundle.questions.map((bundleQuestion, questionIndex) => ({
          id: bundleQuestion.question.id,
          order: questionIndex,
          type: bundleQuestion.question.type,
          level: bundleQuestion.question.level,
          snippet: contentSnippet(bundleQuestion.question.contentJson),
        })),
      })),
    };
  }

  private poolForSection(section: SectionType, pools: CandidatePools) {
    if (section === 'MATH') return pools.math;
    if (section === 'READING') return pools.reading;
    return pools.science;
  }

  private selectionForSection(section: SectionType, selection: Selection) {
    if (section === 'MATH') return selection.math;
    if (section === 'READING') return selection.reading;
    return selection.science;
  }

  private requiredUnits(section: SectionBlueprint) {
    if (section.sectionType === 'MATH') return section.targetQuestionCount ?? 0;
    return section.targetBundleCount ?? 0;
  }

  private resolveTagRule(
    rule: { tagId?: string; tagSlug?: string },
    section: SectionType,
    tags: CandidatePools['tags'],
  ) {
    const tag = tags.find((item) =>
      item.sectionType === section &&
      ((rule.tagId && item.id === rule.tagId) || (rule.tagSlug && item.slug === rule.tagSlug)),
    );
    if (!tag) return new Set<string>();

    const result = new Set<string>([tag.id]);
    const visit = (parentId: string) => {
      tags
        .filter((item) => item.parentId === parentId)
        .forEach((child) => {
          result.add(child.id);
          visit(child.id);
        });
    };
    visit(tag.id);
    return result;
  }

  private resolveRuleCount(rule: { count?: number; percent?: number; min?: number }, total: number) {
    if (rule.count !== undefined) return rule.count;
    if (rule.min !== undefined) return rule.min;
    if (rule.percent !== undefined) return Math.round((total * rule.percent) / 100);
    return 0;
  }

  private availableLevelCount(
    section: SectionType,
    pool: Array<MathCandidate | BundleCandidate>,
    level: CognitiveLevel,
  ) {
    if (section === 'MATH') {
      return (pool as MathCandidate[]).filter((item) => item.level === level).length;
    }
    return (pool as BundleCandidate[]).reduce((sum, item) => sum + item.levelCounts[level], 0);
  }

  private selectedLevelCount(
    section: SectionType,
    selected: Array<MathCandidate | BundleCandidate>,
    level: CognitiveLevel,
  ) {
    return this.availableLevelCount(section, selected, level);
  }
}

function parseSectionType(value: unknown): SectionType {
  if (value === 'MATH' || value === 'READING' || value === 'SCIENCE') return value;
  throw new BadRequestException(`Invalid sectionType: ${String(value)}`);
}

function parseTagRules(value: unknown): TagRule[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!isRecord(item)) throw new BadRequestException('Invalid tag rule');
    return {
      tagId: typeof item.tagId === 'string' ? item.tagId : undefined,
      tagSlug: typeof item.tagSlug === 'string' ? item.tagSlug : undefined,
      count: numberOrUndefined(item.count),
    };
  });
}

function parseChildTagRules(value: unknown): ChildTagRule[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!isRecord(item)) throw new BadRequestException('Invalid child tag rule');
    return {
      tagId: typeof item.tagId === 'string' ? item.tagId : undefined,
      tagSlug: typeof item.tagSlug === 'string' ? item.tagSlug : undefined,
      min: numberOrUndefined(item.min),
      max: numberOrUndefined(item.max),
    };
  });
}

function parseDifficultyRules(value: unknown): DifficultyRule[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!isRecord(item)) throw new BadRequestException('Invalid difficulty rule');
    if (!Object.values(CognitiveLevel).includes(item.level as CognitiveLevel)) {
      throw new BadRequestException(`Invalid difficulty level: ${String(item.level)}`);
    }
    return {
      level: item.level as CognitiveLevel,
      count: numberOrUndefined(item.count),
      percent: numberOrUndefined(item.percent),
      min: numberOrUndefined(item.min),
      max: numberOrUndefined(item.max),
    };
  });
}

function parseQuestionTypeRules(value: unknown): QuestionTypeRule[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!isRecord(item)) throw new BadRequestException('Invalid question type rule');
    if (!Object.values(QuestionType).includes(item.type as QuestionType)) {
      throw new BadRequestException(`Invalid question type: ${String(item.type)}`);
    }
    return {
      type: item.type as QuestionType,
      count: numberOrUndefined(item.count),
      percent: numberOrUndefined(item.percent),
      min: numberOrUndefined(item.min),
      max: numberOrUndefined(item.max),
    };
  });
}

function numberOrUndefined(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function intersects(left: Set<string>, right: Set<string>) {
  for (const value of right) {
    if (left.has(value)) return true;
  }
  return false;
}

function countByLevel(levels: CognitiveLevel[]) {
  return {
    [CognitiveLevel.RECOGNITION]: levels.filter((level) => level === CognitiveLevel.RECOGNITION).length,
    [CognitiveLevel.COMPREHENSION]: levels.filter((level) => level === CognitiveLevel.COMPREHENSION).length,
    [CognitiveLevel.APPLICATION]: levels.filter((level) => level === CognitiveLevel.APPLICATION).length,
    [CognitiveLevel.HIGH_APPLICATION]: levels.filter((level) => level === CognitiveLevel.HIGH_APPLICATION).length,
  };
}

function contentSnippet(value: Prisma.JsonValue, maxLength = 140) {
  const pieces: string[] = [];

  const visit = (node: Prisma.JsonValue) => {
    if (pieces.join(' ').length >= maxLength) return;
    if (typeof node === 'string') {
      pieces.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node && typeof node === 'object') {
      Object.values(node).forEach((child) => visit(child as Prisma.JsonValue));
    }
  };

  visit(value);
  const normalized = pieces.join(' ').replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

function shuffle<T>(items: T[], rng: () => number) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function createSeededRandom(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return () => {
    hash += 0x6d2b79f5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
