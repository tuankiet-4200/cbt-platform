-- Migration: Add GIN index on questions.content_json for JSONB performance
-- and pg_trgm index for fuzzy text search

-- GIN index for JSONB operators (@>, ?, ?|, ?&)
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_questions_content_json_gin
  ON questions USING GIN (content_json);

-- GIN index on tags for fast subtree queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_questions_irt_params_gin
  ON questions USING GIN (irt_params);
