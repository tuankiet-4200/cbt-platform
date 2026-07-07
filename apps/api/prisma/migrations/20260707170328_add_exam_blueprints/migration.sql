-- CreateEnum
CREATE TYPE "ExamBlueprintStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "blueprint_id" TEXT;

-- CreateTable
CREATE TABLE "exam_blueprints" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration_mins" INTEGER NOT NULL DEFAULT 150,
    "status" "ExamBlueprintStatus" NOT NULL DEFAULT 'DRAFT',
    "blueprint_json" JSONB NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_blueprints_status_idx" ON "exam_blueprints"("status");

-- CreateIndex
CREATE INDEX "exam_blueprints_created_by_id_idx" ON "exam_blueprints"("created_by_id");

-- CreateIndex
CREATE INDEX "exams_blueprint_id_idx" ON "exams"("blueprint_id");

-- AddForeignKey
ALTER TABLE "exam_blueprints" ADD CONSTRAINT "exam_blueprints_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_blueprint_id_fkey" FOREIGN KEY ("blueprint_id") REFERENCES "exam_blueprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;
