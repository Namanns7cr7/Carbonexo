-- ============================================================================
--
-- V15 - AI response traces, tool-call audit, user feedback, reviewer comparisons.
-- Consent + retention are columns, not conventions. Nothing here is training data until a
-- reviewer exports it under an approved preference-data job (RAG_INTEGRATION_PLAN.md section 9).
-- ============================================================================

CREATE TABLE ai_responses (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coach_message_id      UUID REFERENCES coach_messages(id) ON DELETE SET NULL,
    surface               VARCHAR(30) NOT NULL,              -- coach_chat | simulation_insight | monthly_report ...
    provider              VARCHAR(40) NOT NULL,
    model                 VARCHAR(80) NOT NULL,
    prompt_template_key   VARCHAR(60),
    prompt_template_ver   INTEGER,
    factor_dataset_version VARCHAR(40),
    corpus_version        VARCHAR(40),
    okf_bundle_digest     CHAR(64),                           -- knowledge bundle version used for this answer
    knowledge_used        JSONB NOT NULL DEFAULT '[]',         -- [{concept_id, chunk_id, grade, generated_at}]
    attestations          JSONB NOT NULL DEFAULT '[]',         -- [{computation, verdict, reasons}] per displayed number
    retrieval_confidence  VARCHAR(8) CHECK (retrieval_confidence IN ('high','medium','low','none')),
    citations             JSONB NOT NULL DEFAULT '[]',        -- [{source_id, chunk_id|factor_id, locator}] validated
    citation_check        VARCHAR(12) NOT NULL DEFAULT 'not_run' CHECK (citation_check IN ('passed','repaired','failed','not_run')),
    numeric_check         VARCHAR(12) NOT NULL DEFAULT 'not_run' CHECK (numeric_check IN ('passed','repaired','stripped','failed','not_run')),
    abstained             BOOLEAN NOT NULL DEFAULT FALSE,
    input_tokens          INTEGER,
    output_tokens         INTEGER,
    latency_ms            INTEGER,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at            TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '180 days'
);
CREATE INDEX ix_ai_responses_user ON ai_responses (user_id, created_at DESC);
CREATE INDEX ix_ai_responses_model ON ai_responses (model, created_at DESC);
CREATE INDEX ix_ai_responses_expiry ON ai_responses (expires_at);

CREATE TABLE ai_tool_calls (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id     UUID NOT NULL REFERENCES ai_responses(id) ON DELETE CASCADE,
    seq             SMALLINT NOT NULL,
    tool_name       VARCHAR(60) NOT NULL,
    arguments       JSONB NOT NULL,
    result_summary  JSONB,                                   -- ids + numbers only; no free text from other users
    status          VARCHAR(16) NOT NULL CHECK (status IN ('ok','not_estimated','denied','timeout','error')),
    latency_ms      INTEGER,
    CONSTRAINT ux_ai_tool_call UNIQUE (response_id, seq)
);

CREATE TABLE ai_feedback (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id         UUID NOT NULL REFERENCES ai_responses(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating              SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
    reasons             TEXT[] NOT NULL DEFAULT '{}' CHECK (reasons <@ ARRAY[
                            'incorrect_number','wrong_citation','missing_citation','not_relevant','unsafe_advice',
                            'unsupported_claim','ignored_my_data','wrong_region','too_long','unclear','helpful','accurate','well_sourced']::text[]),
    comment             VARCHAR(1000),
    correction          VARCHAR(2000),                       -- optional user-supplied corrected answer
    consent_research    BOOLEAN NOT NULL DEFAULT FALSE,      -- may be reviewed/exported for evaluation & tuning
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ux_ai_feedback_once UNIQUE (response_id, user_id)
);

-- Reviewer workflow: two candidate responses to the same (de-identified) prompt.
CREATE TABLE ai_review_pairs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_redacted     TEXT NOT NULL,                       -- PII-scrubbed; never raw user ids/emails
    context_snapshot    JSONB NOT NULL,                      -- tool outputs used (numbers + factor ids)
    response_a_id       UUID REFERENCES ai_responses(id) ON DELETE SET NULL,
    response_b_id       UUID REFERENCES ai_responses(id) ON DELETE SET NULL,
    response_a_text     TEXT NOT NULL,
    response_b_text     TEXT NOT NULL,
    preferred           CHAR(1) CHECK (preferred IN ('A','B','=')),
    rubric              JSONB,                               -- groundedness, citation, numeric, safety, helpfulness 1-5
    reviewer            VARCHAR(120),
    reviewed_at         TIMESTAMPTZ,
    source_feedback_ids UUID[] NOT NULL DEFAULT '{}',
    eval_case_id        VARCHAR(12),                          -- if set, pair is EVAL-ONLY and never exported for training
    export_status       VARCHAR(12) NOT NULL DEFAULT 'held' CHECK (export_status IN ('held','approved','exported','withdrawn')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT eval_pairs_never_exported CHECK (eval_case_id IS NULL OR export_status IN ('held','withdrawn')),
    CONSTRAINT exported_needs_review CHECK (export_status NOT IN ('approved','exported') OR (preferred IN ('A','B') AND reviewer IS NOT NULL))
);

COMMENT ON TABLE ai_feedback IS 'User thumbs + reasons. Only consent_research=true rows may enter reviewer workflows.';
COMMENT ON TABLE ai_review_pairs IS 'Preferred/rejected pairs. Eval-linked pairs can never be exported for training.';
