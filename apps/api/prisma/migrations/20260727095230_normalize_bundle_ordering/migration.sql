-- Normalize legacy PassageBundleQuestion rows that were written as 1..N.
-- The canonical ordering contract is zero-based (0..N-1).
UPDATE "passage_bundle_questions"
SET "order_in_bundle" = -"order_in_bundle"
WHERE "bundle_id" IN (
  SELECT "bundle_id"
  FROM "passage_bundle_questions"
  GROUP BY "bundle_id"
  HAVING MIN("order_in_bundle") = 1
);

UPDATE "passage_bundle_questions"
SET "order_in_bundle" = -"order_in_bundle" - 1
WHERE "order_in_bundle" < 0;
