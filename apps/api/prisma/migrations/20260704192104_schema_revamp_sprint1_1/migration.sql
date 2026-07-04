/*
  Warnings:

  - You are about to drop the `exam_questions` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('PENDING', 'REVIEWING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExamSectionType" AS ENUM ('MATH', 'READING', 'SCIENCE');

-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'MULTIPLE_CHOICE';

-- DropForeignKey
ALTER TABLE "exam_questions" DROP CONSTRAINT "exam_questions_exam_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_questions" DROP CONSTRAINT "exam_questions_question_id_fkey";

-- AlterTable
ALTER TABLE "exam_results" ADD COLUMN     "section_scores" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "exams" ALTER COLUMN "total_points" SET DEFAULT 0,
ALTER COLUMN "total_points" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "contribution_id" TEXT;

-- DropTable
DROP TABLE "exam_questions";

-- CreateTable
CREATE TABLE "contribution_submissions" (
    "id" TEXT NOT NULL,
    "submitter_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "status" "ContributionStatus" NOT NULL DEFAULT 'PENDING',
    "admin_note" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contribution_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passage_bundles" (
    "id" TEXT NOT NULL,
    "section_type" "ExamSectionType" NOT NULL,
    "title" TEXT,
    "content_json" JSONB NOT NULL,
    "expected_time_secs" INTEGER NOT NULL DEFAULT 600,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "author_id" TEXT NOT NULL,
    "reviewed_by_id" TEXT,
    "review_note" TEXT,
    "published_at" TIMESTAMP(3),
    "contribution_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "passage_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passage_bundle_questions" (
    "bundle_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "order_in_bundle" INTEGER NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "passage_bundle_questions_pkey" PRIMARY KEY ("bundle_id","question_id")
);

-- CreateTable
CREATE TABLE "exam_math_questions" (
    "id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "order_in_section" INTEGER NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "exam_math_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_passage_bundles" (
    "id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "passage_bundle_id" TEXT NOT NULL,
    "section_type" "ExamSectionType" NOT NULL,
    "order_in_section" INTEGER NOT NULL,

    CONSTRAINT "exam_passage_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contribution_submissions_submitter_id_idx" ON "contribution_submissions"("submitter_id");

-- CreateIndex
CREATE INDEX "contribution_submissions_status_idx" ON "contribution_submissions"("status");

-- CreateIndex
CREATE INDEX "passage_bundles_section_type_status_idx" ON "passage_bundles"("section_type", "status");

-- CreateIndex
CREATE INDEX "passage_bundles_author_id_idx" ON "passage_bundles"("author_id");

-- CreateIndex
CREATE INDEX "passage_bundles_contribution_id_idx" ON "passage_bundles"("contribution_id");

-- CreateIndex
CREATE UNIQUE INDEX "passage_bundle_questions_question_id_key" ON "passage_bundle_questions"("question_id");

-- CreateIndex
CREATE INDEX "passage_bundle_questions_bundle_id_idx" ON "passage_bundle_questions"("bundle_id");

-- CreateIndex
CREATE UNIQUE INDEX "passage_bundle_questions_bundle_id_order_in_bundle_key" ON "passage_bundle_questions"("bundle_id", "order_in_bundle");

-- CreateIndex
CREATE INDEX "exam_math_questions_exam_id_idx" ON "exam_math_questions"("exam_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_math_questions_exam_id_question_id_key" ON "exam_math_questions"("exam_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_math_questions_exam_id_order_in_section_key" ON "exam_math_questions"("exam_id", "order_in_section");

-- CreateIndex
CREATE INDEX "exam_passage_bundles_exam_id_idx" ON "exam_passage_bundles"("exam_id");

-- CreateIndex
CREATE INDEX "exam_passage_bundles_exam_id_section_type_idx" ON "exam_passage_bundles"("exam_id", "section_type");

-- CreateIndex
CREATE UNIQUE INDEX "exam_passage_bundles_exam_id_passage_bundle_id_key" ON "exam_passage_bundles"("exam_id", "passage_bundle_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_passage_bundles_exam_id_section_type_order_in_section_key" ON "exam_passage_bundles"("exam_id", "section_type", "order_in_section");

-- CreateIndex
CREATE INDEX "questions_contribution_id_idx" ON "questions"("contribution_id");

-- AddForeignKey
ALTER TABLE "contribution_submissions" ADD CONSTRAINT "contribution_submissions_submitter_id_fkey" FOREIGN KEY ("submitter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_submissions" ADD CONSTRAINT "contribution_submissions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "contribution_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passage_bundles" ADD CONSTRAINT "passage_bundles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passage_bundles" ADD CONSTRAINT "passage_bundles_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passage_bundles" ADD CONSTRAINT "passage_bundles_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "contribution_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passage_bundle_questions" ADD CONSTRAINT "passage_bundle_questions_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "passage_bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passage_bundle_questions" ADD CONSTRAINT "passage_bundle_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_math_questions" ADD CONSTRAINT "exam_math_questions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_math_questions" ADD CONSTRAINT "exam_math_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_passage_bundles" ADD CONSTRAINT "exam_passage_bundles_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_passage_bundles" ADD CONSTRAINT "exam_passage_bundles_passage_bundle_id_fkey" FOREIGN KEY ("passage_bundle_id") REFERENCES "passage_bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
