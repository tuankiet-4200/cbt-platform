import { PrismaClient, UserRole, ExamAccessType, QuestionType, QuestionStatus, CognitiveLevel } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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

  // Level 0: Subjects
  const mathTag = await prisma.tag.upsert({
    where: { slug: 'toan-hoc' },
    update: {},
    create: { name: 'Toán học', slug: 'toan-hoc', depth: 0, orderIndex: 0 },
  });
  const physicsTag = await prisma.tag.upsert({
    where: { slug: 'vat-ly' },
    update: {},
    create: { name: 'Vật lý', slug: 'vat-ly', depth: 0, orderIndex: 1 },
  });
  const chemTag = await prisma.tag.upsert({
    where: { slug: 'hoa-hoc' },
    update: {},
    create: { name: 'Hóa học', slug: 'hoa-hoc', depth: 0, orderIndex: 2 },
  });
  const logicTag = await prisma.tag.upsert({
    where: { slug: 'tu-duy-logic' },
    update: {},
    create: { name: 'Tư duy logic', slug: 'tu-duy-logic', depth: 0, orderIndex: 3 },
  });
  const readingTag = await prisma.tag.upsert({
    where: { slug: 'doc-hieu' },
    update: {},
    create: { name: 'Đọc hiểu', slug: 'doc-hieu', depth: 0, orderIndex: 4 },
  });

  // Level 1: Math chapters
  const algebraTag = await prisma.tag.upsert({
    where: { slug: 'dai-so' },
    update: {},
    create: { name: 'Đại số', slug: 'dai-so', parentId: mathTag.id, depth: 1, orderIndex: 0 },
  });
  const calculusTag = await prisma.tag.upsert({
    where: { slug: 'giai-tich' },
    update: {},
    create: { name: 'Giải tích', slug: 'giai-tich', parentId: mathTag.id, depth: 1, orderIndex: 1 },
  });
  const geometryTag = await prisma.tag.upsert({
    where: { slug: 'hinh-hoc' },
    update: {},
    create: { name: 'Hình học', slug: 'hinh-hoc', parentId: mathTag.id, depth: 1, orderIndex: 2 },
  });
  const combinatoricsTag = await prisma.tag.upsert({
    where: { slug: 'to-hop-xac-suat' },
    update: {},
    create: { name: 'Tổ hợp - Xác suất', slug: 'to-hop-xac-suat', parentId: mathTag.id, depth: 1, orderIndex: 3 },
  });

  // Level 2: Topics
  const functionTag = await prisma.tag.upsert({
    where: { slug: 'ham-so' },
    update: {},
    create: { name: 'Hàm số', slug: 'ham-so', parentId: algebraTag.id, depth: 2, orderIndex: 0 },
  });
  const extremaTag = await prisma.tag.upsert({
    where: { slug: 'cuc-tri' },
    update: {},
    create: { name: 'Cực trị', slug: 'cuc-tri', parentId: functionTag.id, depth: 3, orderIndex: 0 },
  });

  console.log('✅ Tag taxonomy created');

  // ── 4. Create Default Exam ────────────────────────────────────────────────
  console.log('\n📝 Creating default exam...');
  const defaultExam = await prisma.exam.upsert({
    where: { id: 'default-exam-id-placeholder' },
    update: {},
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
    },
  });
  console.log(`✅ Default exam created: "${defaultExam.title}"`);

  // ── 5. Auto-grant default exam access to student ───────────────────────────
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

  // ── 6. Create Sample Question ─────────────────────────────────────────────
  console.log('\n❓ Creating sample question...');
  const sampleQuestion = await prisma.question.create({
    data: {
      type: QuestionType.SINGLE_CHOICE,
      status: QuestionStatus.PUBLISHED,
      level: CognitiveLevel.APPLICATION,
      expectedTimeSecs: 90,
      authorId: admin.id,
      reviewedById: admin.id,
      publishedAt: new Date(),
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
      },
      irtParams: {
        a: 1.2,
        b: 0.5,
        c: 0.25,
      },
      tags: {
        create: [
          { tagId: extremaTag.id },
          { tagId: functionTag.id },
          { tagId: algebraTag.id },
        ],
      },
    },
  });
  console.log(`✅ Sample question created: ${sampleQuestion.id}`);

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
