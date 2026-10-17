-- V10: pgvector-backed long-term memory for the AI coach (additive only).
--
-- Creates the `vector` extension and a separate `ai_memory` table. No existing
-- table (activity_logs, rewards, coach_messages, ...) is touched.
--
-- pgvector availability is verified first: plain postgres:16(-alpine) images do
-- not ship it, while Cloud SQL for PostgreSQL 16 does. When the extension is not
-- installable (missing or insufficient privilege) this migration is a logged
-- no-op, so existing databases keep migrating and booting; the backend detects
-- the missing table at runtime and keeps the coach on its non-vector workflow.
--
-- Embedding dimension 768 = actual output of Vertex AI `text-embedding-005`
-- (verified against the live endpoint). Changing the embedding model to one
-- with a different output size requires a new migration, never an edit here.
--
-- No ANN (HNSW) index: every query is filtered to a single user, and the
-- benchmark in database/benchmarks/ai_memory_hnsw.md shows the user_id b-tree +
-- exact distance sort is faster and has perfect recall at realistic volumes.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    RAISE WARNING 'pgvector extension is not available on this server; skipping ai_memory (AI coach memory stays disabled)';
    RETURN;
  END IF;

  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE WARNING 'not permitted to CREATE EXTENSION vector; skipping ai_memory (AI coach memory stays disabled)';
    RETURN;
  END;

  -- EXECUTE so the `vector` type is resolved after the extension exists.
  EXECUTE $ddl$
    CREATE TABLE IF NOT EXISTS ai_memory (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source_type     VARCHAR(32) NOT NULL CHECK (source_type IN ('coach_exchange')),
        source_id       UUID,                     -- coach_messages.id of the user turn (soft link)
        content         TEXT NOT NULL,
        embedding       vector(768) NOT NULL,
        embedding_model VARCHAR(80) NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_ai_memory_source UNIQUE (user_id, source_type, source_id)
    )
  $ddl$;

  -- Every read is "WHERE user_id = ? AND embedding_model = ?"; this index makes
  -- the per-user candidate set cheap to fetch for the exact distance sort.
  EXECUTE 'CREATE INDEX IF NOT EXISTS ix_ai_memory_user_model ON ai_memory (user_id, embedding_model, created_at DESC)';

  EXECUTE $c$COMMENT ON TABLE ai_memory IS 'Per-user semantic memory for the AI coach (pgvector). Derived data: safe to truncate.'$c$;
END
$$;
