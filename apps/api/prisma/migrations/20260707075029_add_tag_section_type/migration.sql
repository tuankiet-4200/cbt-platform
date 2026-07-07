-- AlterTable
ALTER TABLE "tags" ADD COLUMN     "section_type" "ExamSectionType" NOT NULL DEFAULT 'MATH';

UPDATE "tags"
SET "section_type" = 'READING'
WHERE "slug" IN ('doc-hieu');

UPDATE "tags"
SET "section_type" = 'SCIENCE'
WHERE "slug" IN ('vat-ly', 'hoa-hoc');

-- CreateIndex
CREATE INDEX "tags_section_type_idx" ON "tags"("section_type");
