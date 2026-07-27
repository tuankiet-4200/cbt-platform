/*
  Warnings:

  - You are about to drop the column `session_id` on the `exam_results` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[attempt_id]` on the table `exam_results` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[attempt_id,section_type]` on the table `exam_sessions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `attempt_id` to the `exam_results` table without a default value. This is not possible if the table is not empty.
  - Added the required column `attempt_id` to the `exam_sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `duration_mins` to the `exam_sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `section_type` to the `exam_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "exam_results" DROP CONSTRAINT "exam_results_session_id_fkey";

-- DropIndex
DROP INDEX "exam_results_session_id_key";

-- AlterTable
ALTER TABLE "exam_results" DROP COLUMN "session_id",
ADD COLUMN     "attempt_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "exam_sessions" ADD COLUMN     "attempt_id" TEXT NOT NULL,
ADD COLUMN     "duration_mins" INTEGER NOT NULL,
ADD COLUMN     "section_type" "ExamSectionType" NOT NULL;

-- CreateTable
CREATE TABLE "exam_attempts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "current_section" "ExamSectionType",
    "active_key" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_attempts_active_key_key" ON "exam_attempts"("active_key");

-- CreateIndex
CREATE INDEX "exam_attempts_user_id_exam_id_idx" ON "exam_attempts"("user_id", "exam_id");

-- CreateIndex
CREATE INDEX "exam_attempts_status_idx" ON "exam_attempts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "exam_results_attempt_id_key" ON "exam_results"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_sessions_attempt_id_section_type_key" ON "exam_sessions"("attempt_id", "section_type");

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
