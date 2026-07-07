-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "blueprint_json" JSONB,
ADD COLUMN     "generated_at" TIMESTAMP(3),
ADD COLUMN     "generation_seed" TEXT;

-- Section-aware root taxonomy refresh for TSA generation.
-- Root tags are parent_id = NULL and depth = 0.

INSERT INTO "tags" ("id", "name", "slug", "section_type", "parent_id", "depth", "order_index")
VALUES
  ('seed_math_so_hoc', 'Số học', 'so-hoc', 'MATH', NULL, 0, 0),
  ('seed_math_thong_ke_xac_suat', 'Thống kê - Xác suất', 'thong-ke-xac-suat', 'MATH', NULL, 0, 4),
  ('seed_reading_khoa_hoc', 'Khoa học', 'doc-khoa-hoc', 'READING', NULL, 0, 0),
  ('seed_reading_cong_nghe', 'Công nghệ', 'doc-cong-nghe', 'READING', NULL, 0, 1),
  ('seed_reading_kinh_te', 'Kinh tế', 'doc-kinh-te', 'READING', NULL, 0, 2),
  ('seed_reading_ky_thuat', 'Kỹ thuật', 'doc-ky-thuat', 'READING', NULL, 0, 3),
  ('seed_reading_cong_nghiep', 'Công nghiệp', 'doc-cong-nghiep', 'READING', NULL, 0, 4),
  ('seed_reading_nong_nghiep', 'Nông nghiệp', 'doc-nong-nghiep', 'READING', NULL, 0, 5),
  ('seed_reading_tai_chinh', 'Tài chính', 'doc-tai-chinh', 'READING', NULL, 0, 6),
  ('seed_reading_ngan_hang', 'Ngân hàng', 'doc-ngan-hang', 'READING', NULL, 0, 7),
  ('seed_reading_y_duoc', 'Y dược', 'doc-y-duoc', 'READING', NULL, 0, 8),
  ('seed_science_sinh_hoc', 'Sinh học', 'sinh-hoc', 'SCIENCE', NULL, 0, 2)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "section_type" = EXCLUDED."section_type",
  "parent_id" = EXCLUDED."parent_id",
  "depth" = EXCLUDED."depth",
  "order_index" = EXCLUDED."order_index";

UPDATE "tags"
SET "section_type" = 'MATH', "parent_id" = NULL, "depth" = 0, "order_index" = 1
WHERE "slug" = 'dai-so';

UPDATE "tags"
SET "section_type" = 'MATH', "parent_id" = NULL, "depth" = 0, "order_index" = 2
WHERE "slug" = 'ham-so';

UPDATE "tags"
SET "section_type" = 'MATH', "parent_id" = NULL, "depth" = 0, "order_index" = 3
WHERE "slug" = 'hinh-hoc';

UPDATE "tags"
SET "name" = 'Toán học (legacy)',
    "section_type" = 'MATH',
    "parent_id" = (SELECT "id" FROM "tags" WHERE "slug" = 'so-hoc'),
    "depth" = 1,
    "order_index" = 99
WHERE "slug" = 'toan-hoc';

UPDATE "tags"
SET "section_type" = 'MATH',
    "parent_id" = (SELECT "id" FROM "tags" WHERE "slug" = 'dai-so'),
    "depth" = 1,
    "order_index" = 10
WHERE "slug" = 'tu-duy-logic';

UPDATE "tags"
SET "section_type" = 'MATH',
    "parent_id" = (SELECT "id" FROM "tags" WHERE "slug" = 'ham-so'),
    "depth" = 1,
    "order_index" = 0
WHERE "slug" = 'giai-tich';

UPDATE "tags"
SET "section_type" = 'MATH',
    "parent_id" = (SELECT "id" FROM "tags" WHERE "slug" = 'thong-ke-xac-suat'),
    "depth" = 1,
    "order_index" = 0
WHERE "slug" = 'to-hop-xac-suat';

UPDATE "tags"
SET "section_type" = 'MATH',
    "parent_id" = (SELECT "id" FROM "tags" WHERE "slug" = 'ham-so'),
    "depth" = 1,
    "order_index" = 1
WHERE "slug" = 'cuc-tri';

UPDATE "tags"
SET "name" = 'Đọc hiểu (legacy)',
    "section_type" = 'READING',
    "parent_id" = (SELECT "id" FROM "tags" WHERE "slug" = 'doc-khoa-hoc'),
    "depth" = 1,
    "order_index" = 99
WHERE "slug" = 'doc-hieu';

UPDATE "tags"
SET "section_type" = 'SCIENCE', "parent_id" = NULL, "depth" = 0, "order_index" = 0
WHERE "slug" = 'vat-ly';

UPDATE "tags"
SET "section_type" = 'SCIENCE', "parent_id" = NULL, "depth" = 0, "order_index" = 1
WHERE "slug" = 'hoa-hoc';
