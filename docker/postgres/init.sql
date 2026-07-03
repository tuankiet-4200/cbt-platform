-- PostgreSQL init script
-- This runs once when the container is first created

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- For fuzzy text search on question content
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For GIN indexes on JSONB

-- Set timezone
SET timezone = 'Asia/Ho_Chi_Minh';
