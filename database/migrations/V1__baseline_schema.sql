-- ============================================================================
-- V1__baseline_schema.sql — Carbonexo / EcoTrack baseline DDL (Flyway)
-- Executable source of truth. Mirrors database/schema.sql.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---- identity --------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(120),
    role            VARCHAR(20)  NOT NULL DEFAULT 'USER'  CHECK (role IN ('USER','ADMIN')),
    status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','PENDING')),
    email_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by      UUID,
    updated_by      UUID,
    deleted_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX ux_users_email_active ON users (lower(email)) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE refresh_tokens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash    VARCHAR(255) NOT NULL,
    expires_at    TIMESTAMPTZ  NOT NULL,
    revoked_at    TIMESTAMPTZ,
    replaced_by   UUID REFERENCES refresh_tokens(id),
    user_agent    VARCHAR(400),
    ip_address    VARCHAR(64),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_refresh_token_hash ON refresh_tokens (token_hash);

CREATE TABLE user_profiles (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name              VARCHAR(120),
    travel_mode       VARCHAR(40),
    daily_distance_km NUMERIC(8,2) DEFAULT 0,
    diet              VARCHAR(40),
    electricity_usage VARCHAR(40),
    shopping_habit    VARCHAR(40),
    weekly_goal_pct   SMALLINT DEFAULT 15 CHECK (weekly_goal_pct BETWEEN 0 AND 100),
    region            VARCHAR(16) NOT NULL DEFAULT 'GLOBAL',
    onboarded         BOOLEAN  NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by        UUID,
    updated_by        UUID,
    deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX ux_user_profiles_user ON user_profiles (user_id) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_user_profiles_updated BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---- carbon ----------------------------------------------------------------
CREATE TABLE emission_factors (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category           VARCHAR(20) NOT NULL CHECK (category IN ('travel','food','electricity','shopping','waste')),
    factor_key         VARCHAR(60) NOT NULL,
    label              VARCHAR(120) NOT NULL,
    emoji              VARCHAR(16),
    unit               VARCHAR(12) NOT NULL CHECK (unit IN ('km','kWh','item')),
    factor_kg_per_unit NUMERIC(10,4) NOT NULL,
    default_qty        NUMERIC(10,2) DEFAULT 1,
    region             VARCHAR(16) NOT NULL DEFAULT 'GLOBAL',
    source             VARCHAR(200),
    effective_from     DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to       DATE,
    active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by         UUID,
    updated_by         UUID
);
CREATE UNIQUE INDEX ux_emission_factor_key ON emission_factors (category, factor_key, region, effective_from);
CREATE TRIGGER trg_emission_factors_updated BEFORE UPDATE ON emission_factors FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE activity_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category      VARCHAR(20) NOT NULL CHECK (category IN ('travel','food','electricity','shopping','waste')),
    factor_key    VARCHAR(60),
    label         VARCHAR(120) NOT NULL,
    emoji         VARCHAR(16),
    quantity      NUMERIC(10,2),
    unit          VARCHAR(12) CHECK (unit IN ('km','kWh','item')),
    co2_kg        NUMERIC(10,3) NOT NULL,
    note          VARCHAR(200),
    activity_date DATE NOT NULL,
    source        VARCHAR(16) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','bill','ai','import')),
    bill_id       UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by    UUID,
    updated_by    UUID,
    deleted_at    TIMESTAMPTZ
);
CREATE TRIGGER trg_activity_logs_updated BEFORE UPDATE ON activity_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---- bills + ocr -----------------------------------------------------------
CREATE TABLE bills (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blob_container    VARCHAR(120) NOT NULL,
    blob_path         VARCHAR(500) NOT NULL,
    blob_url          VARCHAR(1000),
    original_filename VARCHAR(300),
    content_type      VARCHAR(80) NOT NULL CHECK (content_type IN ('application/pdf','image/png','image/jpeg','image/jpg')),
    size_bytes        BIGINT NOT NULL,
    content_hash      VARCHAR(128),
    status            VARCHAR(20) NOT NULL DEFAULT 'UPLOADED'
                          CHECK (status IN ('UPLOADED','SCANNED','OCR_PENDING','OCR_DONE','CONFIRMED','FAILED')),
    billing_month     DATE,
    units_consumed    NUMERIC(12,2),
    bill_amount       NUMERIC(12,2),
    currency          VARCHAR(8) DEFAULT 'INR',
    scanned_at        TIMESTAMPTZ,
    failure_reason    VARCHAR(400),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by        UUID,
    updated_by        UUID,
    deleted_at        TIMESTAMPTZ
);
CREATE TRIGGER trg_bills_updated BEFORE UPDATE ON bills FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE activity_logs
    ADD CONSTRAINT fk_activity_logs_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL;

CREATE TABLE ocr_results (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id              UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    provider             VARCHAR(40) NOT NULL,
    raw_json             JSONB,
    parsed_billing_month DATE,
    parsed_units         NUMERIC(12,2),
    parsed_amount        NUMERIC(12,2),
    confidence           NUMERIC(5,4),
    corrected            BOOLEAN NOT NULL DEFAULT FALSE,
    corrected_by         UUID,
    corrected_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by           UUID,
    updated_by           UUID
);
CREATE TRIGGER trg_ocr_results_updated BEFORE UPDATE ON ocr_results FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---- action plan -----------------------------------------------------------
CREATE TABLE action_templates (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_key         VARCHAR(60) NOT NULL UNIQUE,
    emoji              VARCHAR(16),
    title              VARCHAR(160) NOT NULL,
    description        VARCHAR(400),
    category           VARCHAR(20) NOT NULL CHECK (category IN ('travel','food','electricity','shopping','waste')),
    difficulty         VARCHAR(10) NOT NULL CHECK (difficulty IN ('Easy','Medium','Hard')),
    saving_kg_per_week NUMERIC(8,2) NOT NULL DEFAULT 0,
    active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by         UUID,
    updated_by         UUID
);
CREATE TRIGGER trg_action_templates_updated BEFORE UPDATE ON action_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE user_plans (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_template_id UUID NOT NULL REFERENCES action_templates(id) ON DELETE CASCADE,
    done               BOOLEAN NOT NULL DEFAULT FALSE,
    added_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    done_at            TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by         UUID,
    updated_by         UUID,
    deleted_at         TIMESTAMPTZ
);
CREATE UNIQUE INDEX ux_user_plan_unique ON user_plans (user_id, action_template_id) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_user_plans_updated BEFORE UPDATE ON user_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---- ai --------------------------------------------------------------------
CREATE TABLE prompt_templates (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key VARCHAR(80) NOT NULL,
    version      INTEGER NOT NULL DEFAULT 1,
    body         TEXT NOT NULL,
    variables    JSONB,
    description  VARCHAR(300),
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by   UUID,
    updated_by   UUID
);
CREATE UNIQUE INDEX ux_prompt_template_key_ver ON prompt_templates (template_key, version);
CREATE TRIGGER trg_prompt_templates_updated BEFORE UPDATE ON prompt_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE recommendations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(40) NOT NULL CHECK (type IN ('reduction','electricity','transport','tip','monthly_report')),
    title      VARCHAR(200),
    body       TEXT,
    payload    JSONB,
    provider   VARCHAR(40),
    model      VARCHAR(80),
    period     VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE coach_messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       VARCHAR(12) NOT NULL CHECK (role IN ('user','assistant','system')),
    content    TEXT NOT NULL,
    provider   VARCHAR(40),
    model      VARCHAR(80),
    tokens     INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- credits + rewards -----------------------------------------------------
CREATE TABLE credit_rules (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_key         VARCHAR(60) NOT NULL UNIQUE,
    rule_type        VARCHAR(30) NOT NULL
                         CHECK (rule_type IN ('PER_KG_SAVED','PER_ACTION_DONE','PER_STREAK_DAY','SIGNUP_BONUS','PER_BILL_UPLOAD')),
    description      VARCHAR(300),
    credits_per_unit NUMERIC(10,2) NOT NULL,
    unit             VARCHAR(20),
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from       DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to         DATE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by       UUID,
    updated_by       UUID
);
CREATE TRIGGER trg_credit_rules_updated BEFORE UPDATE ON credit_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE credit_ledger (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta         INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason        VARCHAR(200) NOT NULL,
    rule_key      VARCHAR(60),
    ref_type      VARCHAR(40),
    ref_id        UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by    UUID
);

CREATE TABLE rewards (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reward_key   VARCHAR(60) NOT NULL UNIQUE,
    title        VARCHAR(200) NOT NULL,
    description  VARCHAR(500),
    cost_credits INTEGER NOT NULL CHECK (cost_credits >= 0),
    stock        INTEGER,
    partner      VARCHAR(120),
    image_url    VARCHAR(1000),
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by   UUID,
    updated_by   UUID,
    deleted_at   TIMESTAMPTZ
);
CREATE TRIGGER trg_rewards_updated BEFORE UPDATE ON rewards FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE redemptions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id    UUID NOT NULL REFERENCES rewards(id),
    cost_credits INTEGER NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','FULFILLED','CANCELLED','REFUNDED')),
    ledger_id    UUID REFERENCES credit_ledger(id),
    fulfilled_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by   UUID,
    updated_by   UUID
);
CREATE TRIGGER trg_redemptions_updated BEFORE UPDATE ON redemptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---- config + audit --------------------------------------------------------
CREATE TABLE app_config (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key   VARCHAR(120) NOT NULL UNIQUE,
    config_value TEXT,
    value_type   VARCHAR(20) NOT NULL DEFAULT 'string' CHECK (value_type IN ('string','int','decimal','bool','json')),
    description  VARCHAR(300),
    secret       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by   UUID
);
CREATE TRIGGER trg_app_config_updated BEFORE UPDATE ON app_config FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE audit_log (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    action     VARCHAR(60) NOT NULL,
    entity     VARCHAR(60),
    entity_id  UUID,
    detail     JSONB,
    ip_address VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
