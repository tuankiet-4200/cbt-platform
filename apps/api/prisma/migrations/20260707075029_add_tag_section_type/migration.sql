-- AlterTable
ALTER TABLE "tags" ADD COLUMN     "section_type" "ExamSectionType" NOT NULL DEFAULT 'MATH';

-- CreateIndex
CREATE INDEX "tags_section_type_idx" ON "tags"("section_type");
