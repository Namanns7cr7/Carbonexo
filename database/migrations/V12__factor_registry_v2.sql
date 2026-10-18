-- ============================================================================
--
-- V12__factor_registry_v2.sql - versioned, provenance-carrying factor registry.
-- Purely additive: the legacy emission_factors / embodied_carbon_factors tables are untouched
-- and keep serving the current app until the cut-over flag (app_config factors.registry=v2).
-- ============================================================================

CREATE TABLE factor_sources (
    source_id           VARCHAR(80) PRIMARY KEY,
    publisher           VARCHAR(200) NOT NULL,
    title               VARCHAR(500) NOT NULL,
    url                 VARCHAR(1000),
    publication_date    VARCHAR(20),
    license_name        VARCHAR(200),
    license_status      VARCHAR(12) NOT NULL CHECK (license_status IN ('verified','unverified')),
    rag_allowed         BOOLEAN NOT NULL DEFAULT FALSE,
    verification_status VARCHAR(24) NOT NULL
                        CHECK (verification_status IN ('verified_primary','verified_secondary','needs_manual_review','pending_fetch','rejected')),
    sha256              CHAR(64),
    retrieved_on        DATE,
    manifest            JSONB NOT NULL,                       -- full SOURCE_MANIFEST entry, incl. review notes
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE factor_dataset_versions (
    version      VARCHAR(40) PRIMARY KEY,                     -- e.g. 2.0.0
    status       VARCHAR(12) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','active','retired')),
    approved_by  VARCHAR(120),
    approved_at  TIMESTAMPTZ,
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT approved_needs_approver CHECK (status IN ('draft','retired') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
-- At most one active dataset version at a time.
CREATE UNIQUE INDEX ux_factor_dataset_single_active ON factor_dataset_versions ((status)) WHERE status = 'active';

CREATE TABLE factor_records (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factor_id           VARCHAR(120) NOT NULL,
    dataset_version     VARCHAR(40) NOT NULL REFERENCES factor_dataset_versions(version),
    record_kind         VARCHAR(24) NOT NULL CHECK (record_kind IN ('emission_factor','benchmark','equivalency','target','behavioural_estimate')),
    value               NUMERIC(14,6) NOT NULL CHECK (value >= 0),
    unit                VARCHAR(40) NOT NULL CHECK (unit ~ '/|%'),
    region              VARCHAR(16) NOT NULL,
    applies_to_regions  TEXT[] NOT NULL,
    proxy_regions       TEXT[] NOT NULL DEFAULT '{}',
    applicable_year     VARCHAR(20) NOT NULL,
    scope               VARCHAR(200) NOT NULL,
    system_boundary     TEXT NOT NULL,
    gases               VARCHAR(80) NOT NULL,
    statistic           VARCHAR(24),
    source_id           VARCHAR(80) NOT NULL REFERENCES factor_sources(source_id),
    citation_of_record  VARCHAR(80) REFERENCES factor_sources(source_id),
    source_locator      VARCHAR(500) NOT NULL,
    verification_status VARCHAR(24) NOT NULL CHECK (verification_status IN ('verified_primary','verified_secondary','needs_manual_review','rejected')),
    scientific_status   VARCHAR(12) NOT NULL CHECK (scientific_status IN ('supported','provisional','unsupported')),
    uncertainty_level   VARCHAR(8)  NOT NULL CHECK (uncertainty_level IN ('low','medium','high','unknown')),
    uncertainty_notes   TEXT,
    superseded_by       VARCHAR(120),
    valid_from          DATE,
    valid_to            DATE,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ux_factor_record UNIQUE (factor_id, dataset_version),
    -- Decision 1 (2026-10-17): UK/US measured values never apply to India, not even as proxies.
    CONSTRAINT no_uk_us_for_india CHECK (region NOT IN ('GB','US') OR NOT ('IN' = ANY (applies_to_regions || proxy_regions))),
    -- A GLOBAL value used as a proxy must carry at least medium uncertainty.
    CONSTRAINT proxy_needs_uncertainty CHECK (cardinality(proxy_regions) = 0 OR uncertainty_level IN ('medium','high'))
);
CREATE INDEX ix_factor_records_lookup ON factor_records (dataset_version, factor_id);

-- Records of an approved/active dataset version are immutable: corrections ship as a new version.
CREATE OR REPLACE FUNCTION factor_records_immutable() RETURNS trigger AS $$
DECLARE v_status VARCHAR(12);
BEGIN
    SELECT status INTO v_status FROM factor_dataset_versions WHERE version = OLD.dataset_version;
    IF v_status IN ('approved','active') THEN
        RAISE EXCEPTION 'factor_records of % dataset version % are immutable; publish a new version', v_status, OLD.dataset_version;
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_factor_records_immutable BEFORE UPDATE OR DELETE ON factor_records
    FOR EACH ROW EXECUTE FUNCTION factor_records_immutable();

-- Maps app catalog activities (Track options, simulation keys) to registry factors per region.
-- status=not_estimated rows are explicit: the UI shows "Not estimated" + missing_information.
CREATE TABLE activity_factor_map (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_version     VARCHAR(40) NOT NULL REFERENCES factor_dataset_versions(version),
    activity_key        VARCHAR(60) NOT NULL,                 -- legacy key, e.g. car_ride, home_electricity
    region              VARCHAR(16) NOT NULL,
    variant             VARCHAR(60) NOT NULL DEFAULT 'default',
    factor_id           VARCHAR(120),
    status              VARCHAR(16) NOT NULL CHECK (status IN ('estimated','provisional','not_estimated')),
    quantity_unit       VARCHAR(12) NOT NULL,                 -- km | kWh | g | item ...
    occupancy_rule      VARCHAR(40),                          -- e.g. divide_by_stated_occupancy
    accounting_rule     VARCHAR(40),                          -- e.g. attribution_of_meter_total
    missing_information TEXT,
    CONSTRAINT ux_activity_factor_map UNIQUE (dataset_version, activity_key, region, variant),
    CONSTRAINT estimated_needs_factor CHECK (status = 'not_estimated' OR factor_id IS NOT NULL),
    CONSTRAINT not_estimated_explains CHECK (status <> 'not_estimated' OR missing_information IS NOT NULL),
    CONSTRAINT fk_activity_factor FOREIGN KEY (factor_id, dataset_version) REFERENCES factor_records (factor_id, dataset_version)
);

COMMENT ON TABLE factor_records IS 'Dataset V2 factor registry. Deterministic lookups only; never filled from semantic search.';
COMMENT ON TABLE activity_factor_map IS 'Catalog activity -> factor per region. not_estimated rows drive the "Not estimated" UI.';
