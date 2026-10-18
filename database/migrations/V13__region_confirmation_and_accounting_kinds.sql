-- ============================================================================
--
-- V13 - Decision 1 (region confirmation) + Decision 2 (separate accounting quantities).
-- Additive only:
--   * no UPDATE of any existing row (historical emissions are not rewritten);
--   * credit_ledger is not touched (no columns, no triggers, no rows);
--   * existing accounts keep region exactly as stored; region_source='legacy_default'
--     records that it was never confirmed, so the UI can ASK rather than reassign.
-- ============================================================================

-- ---- Decision 1: suggested vs confirmed region ----------------------------------------
ALTER TABLE user_profiles
    ADD COLUMN region_confirmed    BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN region_source       VARCHAR(20) NOT NULL DEFAULT 'legacy_default'
        CHECK (region_source IN ('legacy_default','suggested','user_confirmed','user_changed')),
    ADD COLUMN region_confirmed_at TIMESTAMPTZ;
-- New Indian sign-ups: the app writes region='IN', region_source='suggested', region_confirmed=false,
-- then sets user_confirmed/true when the user confirms on onboarding. No backfill.

-- ---- Decision 2: provenance + accounting kind on NEW activity logs -----------------------
ALTER TABLE activity_logs
    ADD COLUMN factor_record_id       VARCHAR(120),
    ADD COLUMN factor_dataset_version VARCHAR(40),
    ADD COLUMN estimate_status        VARCHAR(20)
        CHECK (estimate_status IN ('estimated','provisional','not_estimated')),
    ADD COLUMN attribution_of         UUID REFERENCES activity_logs(id),   -- appliance share of a meter/bill log
    ADD COLUMN verified_by_bill_id    UUID REFERENCES bills(id);
-- Existing rows keep NULLs in all five columns. NULL estimate_status means "legacy, unverified factor"
-- and is surfaced as such; their co2_kg values are preserved byte-for-byte.
-- New not_estimated logs store co2_kg = 0 (column is NOT NULL) AND estimate_status='not_estimated';
-- every V2 aggregate reads v_logged_emissions below, which excludes them from kg totals.

-- One read model the dashboard, reports, groups and AI tools all share.
CREATE VIEW v_logged_emissions AS
SELECT al.id, al.user_id, al.category, al.factor_key, al.activity_date, al.quantity, al.unit, al.co2_kg,
       al.source AS log_source, al.factor_record_id, al.factor_dataset_version,
       COALESCE(al.estimate_status, 'legacy_unverified')                        AS estimate_status,
       al.attribution_of,
       CASE WHEN al.verified_by_bill_id IS NOT NULL THEN 'verified_measurement'
            ELSE 'logged_estimate' END                                          AS quantity_kind,
       (al.attribution_of IS NULL
        AND COALESCE(al.estimate_status, 'legacy_unverified') IN ('estimated','provisional','legacy_unverified')) AS counts_toward_total
FROM activity_logs al
WHERE al.deleted_at IS NULL;

-- Personal baseline: the user's OWN typical emissions for an activity, only when coverage is adequate.
CREATE TABLE personal_baselines (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope_key              VARCHAR(60) NOT NULL,              -- category or activity_key
    period_from            DATE NOT NULL,
    period_to              DATE NOT NULL,
    kg_per_week            NUMERIC(12,3) NOT NULL,
    days_with_logs         INTEGER NOT NULL,
    days_in_period         INTEGER NOT NULL,
    method                 VARCHAR(40) NOT NULL DEFAULT 'trailing_28d_mean_of_logged_days',
    factor_dataset_version VARCHAR(40),
    computed_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT baseline_needs_coverage CHECK (days_with_logs >= 14 AND days_in_period >= 21),
    CONSTRAINT baseline_period_order CHECK (period_to >= period_from)
);
CREATE INDEX ix_personal_baselines_user ON personal_baselines (user_id, scope_key, computed_at DESC);

-- Estimated reduction attributed to a SPECIFIC adopted action, against the personal baseline.
-- Never minted into credits automatically; credits stay governed by credit_rules.
CREATE TABLE reduction_estimates (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_plan_id           UUID REFERENCES user_plans(id),
    baseline_id            UUID NOT NULL REFERENCES personal_baselines(id),
    period_from            DATE NOT NULL,
    period_to              DATE NOT NULL,
    observed_kg_per_week   NUMERIC(12,3) NOT NULL,
    estimated_reduction_kg NUMERIC(12,3) NOT NULL,            -- may be negative (emissions rose)
    evidence_level         VARCHAR(24) NOT NULL CHECK (evidence_level IN ('self_reported','logged_estimate','verified_measurement')),
    method                 VARCHAR(60) NOT NULL,
    factor_dataset_version VARCHAR(40),
    computed_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_reduction_estimates_user ON reduction_estimates (user_id, computed_at DESC);

COMMENT ON VIEW v_logged_emissions IS 'Logged estimates vs verified measurements; excludes appliance attributions and not_estimated logs from totals.';
COMMENT ON TABLE reduction_estimates IS 'Replaces the fixed 8 kg/day carbonSaved(). Estimated, per action, against the user''s own baseline.';
