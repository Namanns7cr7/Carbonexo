-- ============================================================================
--
-- V14 - scientific RAG corpus (pgvector + full-text), physically separate from ai_memory.
-- Same pgvector guard pattern as V10: skips cleanly where the extension is unavailable.
-- No user_id column anywhere in these tables: scientific retrieval can never return user data.
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
      RAISE WARNING 'pgvector not available; skipping scientific corpus (coach answers without evidence retrieval)';
      RETURN;
    END IF;
    CREATE EXTENSION IF NOT EXISTS vector;
  END IF;

  EXECUTE $ddl$
    CREATE TABLE IF NOT EXISTS sci_corpus_versions (
        corpus_version   VARCHAR(40) PRIMARY KEY,
        embedding_model  VARCHAR(80),
        dimensions       INTEGER NOT NULL,
        chunking         JSONB NOT NULL,
        status           VARCHAR(12) NOT NULL DEFAULT 'building' CHECK (status IN ('building','validated','active','retired')),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  $ddl$;
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS ux_sci_corpus_single_active ON sci_corpus_versions ((status)) WHERE status = ''active''';

  EXECUTE $ddl$
    CREATE TABLE IF NOT EXISTS sci_documents (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        corpus_version   VARCHAR(40) NOT NULL REFERENCES sci_corpus_versions(corpus_version),
        source_id        VARCHAR(80) REFERENCES factor_sources(source_id),   -- NULL for Carbonexo-authored OKF concepts
        okf_concept_id   VARCHAR(300),                                       -- e.g. factors/in/elec-grid-fy2024-25
        bundle_digest    CHAR(64),                                           -- OKF bundle version (.okf-build.json)
        title            VARCHAR(500) NOT NULL,
        gcs_uri          VARCHAR(1000) NOT NULL,             -- gs://.../raw/<sha256>.<ext>
        sha256           CHAR(64) NOT NULL,
        region           VARCHAR(16) NOT NULL,
        extracted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT ux_sci_document UNIQUE (corpus_version, source_id, sha256)
    )
  $ddl$;

  EXECUTE $ddl$
    CREATE TABLE IF NOT EXISTS sci_chunks (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id      UUID NOT NULL REFERENCES sci_documents(id) ON DELETE CASCADE,
        corpus_version   VARCHAR(40) NOT NULL REFERENCES sci_corpus_versions(corpus_version),
        source_id        VARCHAR(80),
        okf_concept_id   VARCHAR(300),
        okf_type         VARCHAR(80),
        role             VARCHAR(20) NOT NULL DEFAULT 'evidence' CHECK (role IN ('evidence','internal_guidance')),
        okf_status       VARCHAR(12) NOT NULL DEFAULT 'stable' CHECK (okf_status IN ('draft','stable','deprecated')),
        trust_tier       VARCHAR(20) NOT NULL DEFAULT 'unverified' CHECK (trust_tier IN ('unverified','machine-confirmed','human-reviewed')),
        stale_after      TIMESTAMPTZ,
        generated_at     TIMESTAMPTZ,
        citations        JSONB NOT NULL DEFAULT '[]',          -- [{id, resource, title, attribution: claim|concept}]
        registry_pointer VARCHAR(120),                         -- factor_id when the chunk explains a factor (value masked)
        injection_flags  JSONB NOT NULL DEFAULT '[]',
        chunk_index      INTEGER NOT NULL,
        locator          VARCHAR(300) NOT NULL,              -- "p.87 Annexure E" / "Section 4.4.6"
        heading_path     TEXT,
        content          TEXT NOT NULL,
        content_sha256   CHAR(64) NOT NULL,
        token_count      INTEGER NOT NULL,
        region           VARCHAR(16) NOT NULL,
        embedding        vector(768),                        -- NULL = lexical-only chunk (embedding unavailable at ingest)
        embedding_model  VARCHAR(80),
        tsv              tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(heading_path,'') || ' ' || content)) STORED,
        CONSTRAINT ux_sci_chunk UNIQUE (document_id, chunk_index)
    )
  $ddl$;
  EXECUTE 'CREATE INDEX IF NOT EXISTS ix_sci_chunks_tsv ON sci_chunks USING gin (tsv)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS ix_sci_chunks_filter ON sci_chunks (corpus_version, region, role, okf_status, trust_tier)';
  -- Corpus is small (< 50k chunks expected); HNSW keeps vector search fast as it grows.
  EXECUTE 'CREATE INDEX IF NOT EXISTS ix_sci_chunks_hnsw ON sci_chunks USING hnsw (embedding vector_cosine_ops)';
  EXECUTE $c$COMMENT ON TABLE sci_chunks IS 'Scientific evidence chunks. No user data. Never consulted for numeric factors.'$c$;
END
$$;
