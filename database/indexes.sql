-- ============================================================================
-- Carbonexo / EcoTrack — performance indexes
-- Applied standalone or via migration V8__indexes.sql. Safe to re-run.
-- ============================================================================

-- Identity / sessions
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user      ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_expires   ON refresh_tokens (expires_at);

-- Profiles
CREATE INDEX IF NOT EXISTS ix_user_profiles_user       ON user_profiles (user_id);

-- Emission factors: hot lookup by category + region + recency
CREATE INDEX IF NOT EXISTS ix_emission_factors_lookup
    ON emission_factors (category, region, active, effective_from DESC);

-- Activity logs: the hottest query — a user's logs in a date window
CREATE INDEX IF NOT EXISTS ix_activity_logs_user_date
    ON activity_logs (user_id, activity_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_activity_logs_user_cat
    ON activity_logs (user_id, category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_activity_logs_bill        ON activity_logs (bill_id);

-- Bills + OCR
CREATE INDEX IF NOT EXISTS ix_bills_user_status
    ON bills (user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_bills_content_hash        ON bills (content_hash);
CREATE INDEX IF NOT EXISTS ix_ocr_results_bill          ON ocr_results (bill_id);

-- Action plan
CREATE INDEX IF NOT EXISTS ix_user_plans_user           ON user_plans (user_id) WHERE deleted_at IS NULL;

-- AI
CREATE INDEX IF NOT EXISTS ix_recommendations_user_type ON recommendations (user_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_coach_messages_user       ON coach_messages (user_id, created_at);

-- Credits / rewards
CREATE INDEX IF NOT EXISTS ix_credit_ledger_user        ON credit_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_redemptions_user          ON redemptions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_rewards_active            ON rewards (active) WHERE deleted_at IS NULL;

-- Config / audit
CREATE INDEX IF NOT EXISTS ix_app_config_key            ON app_config (config_key);
CREATE INDEX IF NOT EXISTS ix_audit_log_user            ON audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_log_entity          ON audit_log (entity, entity_id);
