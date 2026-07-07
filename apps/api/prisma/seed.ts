import { Prisma, PrismaClient, UserRole, ExamAccessType, ExamBlueprintStatus, ExamSectionType, QuestionType, QuestionStatus, CognitiveLevel } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

type RichTextNode = { type: 'text'; content: string };

const TSA_STANDARD_BLUEPRINT: Prisma.InputJsonValue = {
  version: 1,
  durationMins: 150,
  randomization: {
    seed: 'tsa-admin-draft',
    maxAttempts: 5,
  },
  sections: [
    { sectionType: 'MATH', targetQuestionCount: 50 },
    { sectionType: 'READING', targetBundleCount: 2, targetQuestionCount: 20 },
    { sectionType: 'SCIENCE', targetBundleCount: 3, targetQuestionCount: 15 },
  ],
};

const LEVELS = [
  CognitiveLevel.RECOGNITION,
  CognitiveLevel.COMPREHENSION,
  CognitiveLevel.APPLICATION,
  CognitiveLevel.HIGH_APPLICATION,
];

function text(content: string): RichTextNode[] {
  return [{ type: 'text', content }];
}

function singleChoiceContent(
  stem: RichTextNode[],
  correctAnswer: string,
  distractors: string[],
  solution: string,
): Prisma.InputJsonValue {
  return {
    stem,
    type: 'SINGLE_CHOICE',
    payload: {
      options: [
        { id: 'A', content: text(distractors[0]), isCorrect: false },
        { id: 'B', content: text(correctAnswer), isCorrect: true },
        { id: 'C', content: text(distractors[1]), isCorrect: false },
        { id: 'D', content: text(distractors[2]), isCorrect: false },
      ],
    },
    solution: text(solution),
    _version: 2,
  };
}

async function upsertPublishedQuestion(params: {
  id: string;
  authorId: string;
  tagIds?: string[];
  type?: QuestionType;
  level: CognitiveLevel;
  expectedTimeSecs: number;
  contentJson: Prisma.InputJsonValue;
  irtParams?: Prisma.InputJsonValue;
}) {
  return prisma.question.upsert({
    where: { id: params.id },
    update: {
      type: params.type ?? QuestionType.SINGLE_CHOICE,
      status: QuestionStatus.PUBLISHED,
      level: params.level,
      expectedTimeSecs: params.expectedTimeSecs,
      authorId: params.authorId,
      reviewedById: params.authorId,
      publishedAt: new Date(),
      contentJson: params.contentJson,
      irtParams: params.irtParams ?? { a: 1.0, b: 0.0, c: 0.25 },
      tags: {
        deleteMany: {},
        create: params.tagIds?.map((tagId) => ({ tagId })) ?? [],
      },
    },
    create: {
      id: params.id,
      type: params.type ?? QuestionType.SINGLE_CHOICE,
      status: QuestionStatus.PUBLISHED,
      level: params.level,
      expectedTimeSecs: params.expectedTimeSecs,
      authorId: params.authorId,
      reviewedById: params.authorId,
      publishedAt: new Date(),
      contentJson: params.contentJson,
      irtParams: params.irtParams ?? { a: 1.0, b: 0.0, c: 0.25 },
      tags: params.tagIds?.length
        ? { create: params.tagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
  });
}

async function seedMockMathQuestions(authorId: string, mathRootTagIds: string[]) {
  const templates = [
    (index: number) => {
      const a = 12 + index;
      const b = 7 + (index % 9);
      const answer = a + b;
      return singleChoiceContent(
        text(`Mock MATH ${String(index).padStart(3, '0')}: Tính ${a} + ${b}.`),
        String(answer),
        [String(answer - 1), String(answer + 2), String(answer + 5)],
        `Cộng hai số ta được ${answer}.`,
      );
    },
    (index: number) => {
      const x = 3 + (index % 11);
      const n = 5 + (index % 7);
      const total = x + n;
      return singleChoiceContent(
        text(`Mock MATH ${String(index).padStart(3, '0')}: Giải phương trình x + ${n} = ${total}.`),
        String(x),
        [String(x - 1), String(x + 1), String(x + 3)],
        `Chuyển vế: x = ${total} - ${n} = ${x}.`,
      );
    },
    (index: number) => {
      const k = 2 + (index % 6);
      const n = index % 10;
      const answer = 2 * k + n;
      return singleChoiceContent(
        text(`Mock MATH ${String(index).padStart(3, '0')}: Cho f(x) = 2x + ${n}. Tính f(${k}).`),
        String(answer),
        [String(answer - 2), String(answer + 1), String(answer + 4)],
        `Thay x = ${k}: f(${k}) = 2.${k} + ${n} = ${answer}.`,
      );
    },
    (index: number) => {
      const length = 4 + (index % 8);
      const width = 3 + (index % 5);
      const answer = 2 * (length + width);
      return singleChoiceContent(
        text(`Mock MATH ${String(index).padStart(3, '0')}: Hình chữ nhật có chiều dài ${length} và chiều rộng ${width}. Tính chu vi.`),
        String(answer),
        [String(length * width), String(answer - 2), String(answer + 4)],
        `Chu vi hình chữ nhật là 2(${length} + ${width}) = ${answer}.`,
      );
    },
    (index: number) => {
      const base = 5 + (index % 6);
      const values = [base, base + 2, base + 4];
      const answer = base + 2;
      return singleChoiceContent(
        text(`Mock MATH ${String(index).padStart(3, '0')}: Tính trung bình cộng của ${values.join(', ')}.`),
        String(answer),
        [String(answer - 1), String(answer + 1), String(answer + 3)],
        `Tổng là ${values.reduce((sum, value) => sum + value, 0)}, chia cho 3 được ${answer}.`,
      );
    },
  ];

  const tagPlan = [
    ...Array(8).fill(0),
    ...Array(12).fill(1),
    ...Array(10).fill(2),
    ...Array(10).fill(3),
    ...Array(10).fill(4),
  ] as number[];

  for (let index = 1; index <= tagPlan.length; index += 1) {
    const tagIndex = tagPlan[index - 1];
    await upsertPublishedQuestion({
      id: `seed-math-mock-${String(index).padStart(3, '0')}`,
      authorId,
      tagIds: [mathRootTagIds[tagIndex]],
      level: LEVELS[(index - 1) % LEVELS.length],
      expectedTimeSecs: 90,
      contentJson: templates[tagIndex](index),
    });
  }
}

async function seedMockBundle(params: {
  id: string;
  sectionType: 'READING' | 'SCIENCE';
  title: string;
  passage: string;
  authorId: string;
  tagIds: string[];
  questionCount: number;
  expectedTimeSecs: number;
}) {
  const bundle = await prisma.passageBundle.upsert({
    where: { id: params.id },
    update: {
      sectionType: params.sectionType,
      title: params.title,
      contentJson: text(params.passage),
      expectedTimeSecs: params.expectedTimeSecs,
      status: QuestionStatus.PUBLISHED,
      authorId: params.authorId,
      reviewedById: params.authorId,
      publishedAt: new Date(),
      tags: {
        deleteMany: {},
        create: params.tagIds.map((tagId) => ({ tagId })),
      },
    },
    create: {
      id: params.id,
      sectionType: params.sectionType,
      title: params.title,
      contentJson: text(params.passage),
      expectedTimeSecs: params.expectedTimeSecs,
      status: QuestionStatus.PUBLISHED,
      authorId: params.authorId,
      reviewedById: params.authorId,
      publishedAt: new Date(),
      tags: { create: params.tagIds.map((tagId) => ({ tagId })) },
    },
  });

  for (let index = 1; index <= params.questionCount; index += 1) {
    const questionId = `${params.id}-q${String(index).padStart(2, '0')}`;
    await upsertPublishedQuestion({
      id: questionId,
      authorId: params.authorId,
      level: LEVELS[(index - 1) % LEVELS.length],
      expectedTimeSecs: params.sectionType === 'READING' ? 75 : 90,
      contentJson: singleChoiceContent(
        text(`${params.title} - Câu ${index}: Theo dữ kiện trong đoạn, lựa chọn nào phù hợp nhất?`),
        `Ý đúng ${index}`,
        [`Nhiễu ${index}.1`, `Nhiễu ${index}.2`, `Nhiễu ${index}.3`],
        `Câu trả lời đúng được suy ra trực tiếp từ mock passage của bundle "${params.title}".`,
      ),
    });

    await prisma.passageBundleQuestion.upsert({
      where: {
        bundleId_questionId: {
          bundleId: bundle.id,
          questionId,
        },
      },
      update: {
        orderInBundle: index - 1,
        points: 1,
      },
      create: {
        bundleId: bundle.id,
        questionId,
        orderInBundle: index - 1,
        points: 1,
      },
    });
  }
}

async function seedMockPassageBundles(authorId: string, tagIds: Record<string, string>) {
  const readingBundles = [
    {
      id: 'seed-reading-bundle-001',
      title: 'Mock READING - Khoa học vật liệu xanh',
      passage: 'Một nhóm nghiên cứu phát triển vật liệu xanh từ phụ phẩm nông nghiệp. Đoạn đọc mô tả mục tiêu, phương pháp thử nghiệm và tác động môi trường của vật liệu mới.',
      tagSlug: 'doc-khoa-hoc',
    },
    {
      id: 'seed-reading-bundle-002',
      title: 'Mock READING - Công nghệ dữ liệu đô thị',
      passage: 'Bài đọc trình bày cách dữ liệu cảm biến hỗ trợ điều phối giao thông, tiết kiệm năng lượng và cải thiện dịch vụ công trong đô thị thông minh.',
      tagSlug: 'doc-cong-nghe',
    },
    {
      id: 'seed-reading-bundle-003',
      title: 'Mock READING - Kinh tế chuỗi cung ứng',
      passage: 'Đoạn đọc phân tích biến động chi phí logistics, vai trò của dự báo nhu cầu và tác động của quản trị tồn kho đến doanh nghiệp sản xuất.',
      tagSlug: 'doc-kinh-te',
    },
  ];

  for (const bundle of readingBundles) {
    await seedMockBundle({
      id: bundle.id,
      sectionType: ExamSectionType.READING,
      title: bundle.title,
      passage: bundle.passage,
      authorId,
      tagIds: [tagIds[bundle.tagSlug]],
      questionCount: 10,
      expectedTimeSecs: 1200,
    });
  }

  const scienceRoots = ['vat-ly', 'hoa-hoc', 'sinh-hoc'];
  for (let index = 1; index <= 10; index += 1) {
    const rootSlug = scienceRoots[(index - 1) % scienceRoots.length];
    await seedMockBundle({
      id: `seed-science-bundle-${String(index).padStart(3, '0')}`,
      sectionType: ExamSectionType.SCIENCE,
      title: `Mock SCIENCE ${String(index).padStart(2, '0')} - ${rootSlug}`,
      passage: `Stimulus khoa học mock số ${index} mô tả một thí nghiệm, bảng quan sát và kết luận sơ bộ thuộc nhóm ${rootSlug}.`,
      authorId,
      tagIds: [tagIds[rootSlug]],
      questionCount: 5,
      expectedTimeSecs: 900,
    });
  }
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ── 1. Create Admin User ──────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@cbt-platform.com' },
    update: {
      passwordHash: adminPassword,
      displayName: 'System Admin',
      role: UserRole.ADMIN,
      isActive: true,
    },
    create: {
      email: 'admin@cbt-platform.com',
      passwordHash: adminPassword,
      displayName: 'System Admin',
      role: UserRole.ADMIN,
    },
  });
  console.log(`✅ Admin user: ${admin.email}`);

  // ── 2. Create Sample Student ──────────────────────────────────────────────
  const studentPassword = await bcrypt.hash('Student@123', 12);
  const student = await prisma.user.upsert({
    where: { email: 'student@example.com' },
    update: {
      passwordHash: studentPassword,
      displayName: 'Nguyễn Văn A',
      role: UserRole.USER,
      isActive: true,
    },
    create: {
      email: 'student@example.com',
      passwordHash: studentPassword,
      displayName: 'Nguyễn Văn A',
      role: UserRole.USER,
    },
  });
  console.log(`✅ Student user: ${student.email}`);

  // ── 3. Create Tag Taxonomy ────────────────────────────────────────────────
  console.log('\n📚 Creating tag taxonomy...');

  // Level 0: MATH concrete domains
  const arithmeticTag = await prisma.tag.upsert({
    where: { slug: 'so-hoc' },
    update: { name: 'Số học', sectionType: ExamSectionType.MATH, parentId: null, depth: 0, orderIndex: 0 },
    create: { name: 'Số học', slug: 'so-hoc', sectionType: ExamSectionType.MATH, depth: 0, orderIndex: 0 },
  });
  const algebraTag = await prisma.tag.upsert({
    where: { slug: 'dai-so' },
    update: { name: 'Đại số', sectionType: ExamSectionType.MATH, parentId: null, depth: 0, orderIndex: 1 },
    create: { name: 'Đại số', slug: 'dai-so', sectionType: ExamSectionType.MATH, depth: 0, orderIndex: 1 },
  });
  const functionTag = await prisma.tag.upsert({
    where: { slug: 'ham-so' },
    update: { name: 'Hàm số', sectionType: ExamSectionType.MATH, parentId: null, depth: 0, orderIndex: 2 },
    create: { name: 'Hàm số', slug: 'ham-so', sectionType: ExamSectionType.MATH, depth: 0, orderIndex: 2 },
  });
  const geometryTag = await prisma.tag.upsert({
    where: { slug: 'hinh-hoc' },
    update: { name: 'Hình học', sectionType: ExamSectionType.MATH, parentId: null, depth: 0, orderIndex: 3 },
    create: { name: 'Hình học', slug: 'hinh-hoc', sectionType: ExamSectionType.MATH, depth: 0, orderIndex: 3 },
  });
  const statisticsProbabilityTag = await prisma.tag.upsert({
    where: { slug: 'thong-ke-xac-suat' },
    update: { name: 'Thống kê - Xác suất', sectionType: ExamSectionType.MATH, parentId: null, depth: 0, orderIndex: 4 },
    create: { name: 'Thống kê - Xác suất', slug: 'thong-ke-xac-suat', sectionType: ExamSectionType.MATH, depth: 0, orderIndex: 4 },
  });
  await prisma.tag.upsert({
    where: { slug: 'toan-hoc' },
    update: { name: 'Toán học (legacy)', sectionType: ExamSectionType.MATH, parentId: arithmeticTag.id, depth: 1, orderIndex: 99 },
    create: { name: 'Toán học (legacy)', slug: 'toan-hoc', sectionType: ExamSectionType.MATH, parentId: arithmeticTag.id, depth: 1, orderIndex: 99 },
  });
  await prisma.tag.upsert({
    where: { slug: 'tu-duy-logic' },
    update: { sectionType: ExamSectionType.MATH, parentId: algebraTag.id, depth: 1, orderIndex: 10 },
    create: { name: 'Tư duy logic', slug: 'tu-duy-logic', sectionType: ExamSectionType.MATH, parentId: algebraTag.id, depth: 1, orderIndex: 10 },
  });

  // Level 0: READING passage topic domains
  const readingRootTags = [
    ['doc-khoa-hoc', 'Khoa học'],
    ['doc-cong-nghe', 'Công nghệ'],
    ['doc-kinh-te', 'Kinh tế'],
    ['doc-ky-thuat', 'Kỹ thuật'],
    ['doc-cong-nghiep', 'Công nghiệp'],
    ['doc-nong-nghiep', 'Nông nghiệp'],
    ['doc-tai-chinh', 'Tài chính'],
    ['doc-ngan-hang', 'Ngân hàng'],
    ['doc-y-duoc', 'Y dược'],
  ] as const;
  for (const [index, [slug, name]] of readingRootTags.entries()) {
    await prisma.tag.upsert({
      where: { slug },
      update: { name, sectionType: ExamSectionType.READING, parentId: null, depth: 0, orderIndex: index },
      create: { name, slug, sectionType: ExamSectionType.READING, depth: 0, orderIndex: index },
    });
  }
  const readingScienceTag = await prisma.tag.findUniqueOrThrow({ where: { slug: 'doc-khoa-hoc' } });
  await prisma.tag.upsert({
    where: { slug: 'doc-hieu' },
    update: { name: 'Đọc hiểu (legacy)', sectionType: ExamSectionType.READING, parentId: readingScienceTag.id, depth: 1, orderIndex: 99 },
    create: { name: 'Đọc hiểu (legacy)', slug: 'doc-hieu', sectionType: ExamSectionType.READING, parentId: readingScienceTag.id, depth: 1, orderIndex: 99 },
  });

  // Level 0: SCIENCE domains
  await prisma.tag.upsert({
    where: { slug: 'vat-ly' },
    update: { sectionType: ExamSectionType.SCIENCE, parentId: null, depth: 0, orderIndex: 0 },
    create: { name: 'Vật lý', slug: 'vat-ly', sectionType: ExamSectionType.SCIENCE, depth: 0, orderIndex: 0 },
  });
  await prisma.tag.upsert({
    where: { slug: 'hoa-hoc' },
    update: { sectionType: ExamSectionType.SCIENCE, parentId: null, depth: 0, orderIndex: 1 },
    create: { name: 'Hóa học', slug: 'hoa-hoc', sectionType: ExamSectionType.SCIENCE, depth: 0, orderIndex: 1 },
  });
  await prisma.tag.upsert({
    where: { slug: 'sinh-hoc' },
    update: { sectionType: ExamSectionType.SCIENCE, parentId: null, depth: 0, orderIndex: 2 },
    create: { name: 'Sinh học', slug: 'sinh-hoc', sectionType: ExamSectionType.SCIENCE, depth: 0, orderIndex: 2 },
  });

  // Level 1+: existing sample child taxonomy under concrete MATH roots
  await prisma.tag.upsert({
    where: { slug: 'giai-tich' },
    update: { sectionType: ExamSectionType.MATH, parentId: functionTag.id, depth: 1, orderIndex: 0 },
    create: { name: 'Giải tích', slug: 'giai-tich', sectionType: ExamSectionType.MATH, parentId: functionTag.id, depth: 1, orderIndex: 0 },
  });
  await prisma.tag.upsert({
    where: { slug: 'to-hop-xac-suat' },
    update: { name: 'Tổ hợp - Xác suất', sectionType: ExamSectionType.MATH, parentId: statisticsProbabilityTag.id, depth: 1, orderIndex: 0 },
    create: { name: 'Tổ hợp - Xác suất', slug: 'to-hop-xac-suat', sectionType: ExamSectionType.MATH, parentId: statisticsProbabilityTag.id, depth: 1, orderIndex: 0 },
  });
  const extremaTag = await prisma.tag.upsert({
    where: { slug: 'cuc-tri' },
    update: { sectionType: ExamSectionType.MATH, parentId: functionTag.id, depth: 1, orderIndex: 1 },
    create: { name: 'Cực trị', slug: 'cuc-tri', sectionType: ExamSectionType.MATH, parentId: functionTag.id, depth: 1, orderIndex: 1 },
  });

  console.log('✅ Tag taxonomy created');

  const mockTagRows = await prisma.tag.findMany({
    where: {
      slug: {
        in: [
          'doc-khoa-hoc',
          'doc-cong-nghe',
          'doc-kinh-te',
          'vat-ly',
          'hoa-hoc',
          'sinh-hoc',
        ],
      },
    },
  });
  const mockTagIds = Object.fromEntries(mockTagRows.map((tag) => [tag.slug, tag.id]));

  // ── 4. Create Default Exam Blueprint ──────────────────────────────────────
  console.log('\n🧩 Creating default exam blueprint...');
  const defaultBlueprint = await prisma.examBlueprint.upsert({
    where: { id: 'default-tsa-standard-blueprint' },
    update: {
      name: 'TSA Standard Matrix',
      description: '50 Math questions, 2 Reading bundles, 3 Science bundles',
      durationMins: 150,
      status: ExamBlueprintStatus.ACTIVE,
      blueprintJson: TSA_STANDARD_BLUEPRINT,
      createdById: admin.id,
    },
    create: {
      id: 'default-tsa-standard-blueprint',
      name: 'TSA Standard Matrix',
      description: '50 Math questions, 2 Reading bundles, 3 Science bundles',
      durationMins: 150,
      status: ExamBlueprintStatus.ACTIVE,
      blueprintJson: TSA_STANDARD_BLUEPRINT,
      createdById: admin.id,
    },
  });
  console.log(`✅ Default blueprint created: "${defaultBlueprint.name}"`);

  // ── 5. Create Default Exam ────────────────────────────────────────────────
  console.log('\n📝 Creating default exam...');
  const defaultExam = await prisma.exam.upsert({
    where: { id: 'default-exam-id-placeholder' },
    update: {
      blueprintId: defaultBlueprint.id,
      blueprintJson: TSA_STANDARD_BLUEPRINT,
    },
    create: {
      id: 'default-exam-id-placeholder', // Fixed ID for easy reference in auth service
      title: 'Đề thi thử TSA - Đề cơ bản (Miễn phí)',
      description: 'Đề thi thử miễn phí dành cho tất cả học sinh. Mô phỏng cấu trúc thi TSA Đại học Bách Khoa Hà Nội.',
      instructions: `## Hướng dẫn làm bài

Chào mừng bạn đến với bài thi thử TSA!

**Cấu trúc đề thi:**
- Tổng số câu: 150 câu
- Thời gian: 150 phút (1 phút/câu)
- Gồm 4 dạng câu hỏi: Trắc nghiệm, Đúng/Sai, Điền số, Kéo thả

**Lưu ý quan trọng:**
- Hệ thống sẽ tự động lưu đáp án của bạn mỗi 30 giây.
- Bài thi yêu cầu chế độ toàn màn hình. Thoát khỏi toàn màn hình sẽ bị ghi lại.
- Nếu mất kết nối, đáp án vẫn được lưu trên thiết bị và sẽ được đồng bộ khi có mạng.

Chúc bạn làm bài tốt! 🎯`,
      durationMins: 150,
      totalPoints: 150,
      accessType: ExamAccessType.PUBLIC,
      isPublished: true,
      blueprintId: defaultBlueprint.id,
      blueprintJson: TSA_STANDARD_BLUEPRINT,
    },
  });
  console.log(`✅ Default exam created: "${defaultExam.title}"`);

  // ── 6. Auto-grant default exam access to student ───────────────────────────
  await prisma.examAccess.upsert({
    where: {
      userId_examId: {
        userId: student.id,
        examId: defaultExam.id,
      },
    },
    update: {},
    create: {
      userId: student.id,
      examId: defaultExam.id,
    },
  });
  console.log(`✅ Default exam access granted to ${student.email}`);

  // ── 7. Create Sample Question ─────────────────────────────────────────────
  console.log('\n❓ Creating sample question...');
  const sampleQuestion = await upsertPublishedQuestion({
    id: 'seed-sample-math-extrema',
    authorId: admin.id,
    level: CognitiveLevel.APPLICATION,
    expectedTimeSecs: 90,
    tagIds: [extremaTag.id, functionTag.id, algebraTag.id],
    irtParams: {
      a: 1.2,
      b: 0.5,
      c: 0.25,
    },
    contentJson: {
      stem: [
        {
          type: 'text',
          content: 'Tìm giá trị lớn nhất của hàm số ',
        },
        {
          type: 'latex',
          content: 'f(x) = -x^3 + 3x^2 + 9x - 1',
        },
        {
          type: 'text',
          content: ' trên đoạn ',
        },
        {
          type: 'latex',
          content: '[-2, 4]',
        },
      ],
      type: 'SINGLE_CHOICE',
      payload: {
        options: [
          { id: 'A', content: [{ type: 'latex', content: '22' }], isCorrect: false },
          { id: 'B', content: [{ type: 'latex', content: '26' }], isCorrect: true },
          { id: 'C', content: [{ type: 'latex', content: '-22' }], isCorrect: false },
          { id: 'D', content: [{ type: 'latex', content: '28' }], isCorrect: false },
        ],
      },
      solution: [
        { type: 'text', content: 'Ta có: ' },
        { type: 'latex', content: "f'(x) = -3x^2 + 6x + 9 = -3(x^2 - 2x - 3) = -3(x-3)(x+1)" },
        { type: 'text', content: '. Trên [-2, 4], các điểm tới hạn: x = -1, x = 3. Tính: f(-2) = -3, f(-1) = -6, f(3) = 26, f(4) = 19. Vậy max = 26.' },
      ],
      _version: 2,
    },
  });
  console.log(`✅ Sample question created: ${sampleQuestion.id}`);

  console.log('\n🧪 Creating mock TSA generation bank...');
  await seedMockMathQuestions(admin.id, [
    arithmeticTag.id,
    algebraTag.id,
    functionTag.id,
    geometryTag.id,
    statisticsProbabilityTag.id,
  ]);
  await seedMockPassageBundles(admin.id, mockTagIds);
  console.log('✅ Mock bank created: 50 MATH questions, 3 READING bundles, 10 SCIENCE bundles');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\nLogin credentials:');
  console.log('  Admin: admin@cbt-platform.com / Admin@123456');
  console.log('  Student: student@example.com / Student@123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
