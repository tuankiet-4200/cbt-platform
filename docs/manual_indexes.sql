-- Add GIN indexes on JSONB columns for fast JSON operations
-- Run this AFTER the main migration

-- GIN index for content_json JSONB operators (@>, ?, ?|, ?&)
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_questions_content_json_gin
  ON questions USING GIN (content_json);

-- GIN index for irt_params
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_questions_irt_params_gin
  ON questions USING GIN (irt_params);

-- GIN index for tag_breakdown in exam_results
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_exam_results_tag_breakdown_gin
  ON exam_results USING GIN (tag_breakdown);
