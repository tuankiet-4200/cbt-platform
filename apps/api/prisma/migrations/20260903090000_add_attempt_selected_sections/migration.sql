-- AlterTable
ALTER TABLE "exam_attempts"
ADD COLUMN "selected_sections" "ExamSectionType"[] NOT NULL DEFAULT ARRAY[]::"ExamSectionType"[];

-- Existing attempts always followed every section assembled in their exam.
-- Backfill that scope in the canonical MATH -> READING -> SCIENCE order.
UPDATE "exam_attempts" AS attempt
SET "selected_sections" = ARRAY(
  SELECT candidate.section_type
  FROM (
    VALUES
      ('MATH'::"ExamSectionType", 1),
      ('READING'::"ExamSectionType", 2),
      ('SCIENCE'::"ExamSectionType", 3)
  ) AS candidate(section_type, position)
  WHERE
    (candidate.section_type = 'MATH' AND EXISTS (
      SELECT 1 FROM "exam_math_questions" math
      WHERE math."exam_id" = attempt."exam_id"
    ))
    OR
    (candidate.section_type IN ('READING', 'SCIENCE') AND EXISTS (
      SELECT 1 FROM "exam_passage_bundles" bundle
      WHERE bundle."exam_id" = attempt."exam_id"
        AND bundle."section_type" = candidate.section_type
    ))
  ORDER BY candidate.position
);
