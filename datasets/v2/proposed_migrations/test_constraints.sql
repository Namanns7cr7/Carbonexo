-- Constraint tests for the V12-V15 drafts. Run on a THROWAWAY database after applying them +
-- build/registry_seed.*.sql. Everything happens inside one transaction that is rolled back.
-- Prints PASS/FAIL per check; exits non-zero (via ON_ERROR_STOP) on the first FAIL.
\set ON_ERROR_STOP 1
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.expect_error(label text, stmt text) RETURNS void AS $$
BEGIN
    BEGIN
        EXECUTE stmt;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'PASS  % (rejected: %)', label, SQLERRM;
        RETURN;
    END;
    RAISE EXCEPTION 'FAIL  % (statement was accepted)', label;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pg_temp.expect_true(label text, cond boolean) RETURNS void AS $$
BEGIN
    IF cond THEN RAISE NOTICE 'PASS  %', label; ELSE RAISE EXCEPTION 'FAIL  %', label; END IF;
END $$ LANGUAGE plpgsql;

SELECT pg_temp.expect_true('registry seed loaded 80 factors', (SELECT count(*) = 80 FROM factor_records));
SELECT pg_temp.expect_true('no seeded GB/US factor applies to IN',
    NOT EXISTS (SELECT 1 FROM factor_records WHERE region IN ('GB','US') AND 'IN' = ANY (applies_to_regions || proxy_regions)));

SELECT pg_temp.expect_error('Decision 1: GB factor cannot be an IN proxy', $q$
    INSERT INTO factor_records (factor_id, dataset_version, record_kind, value, unit, region, applies_to_regions, proxy_regions,
        applicable_year, scope, system_boundary, gases, source_id, source_locator, verification_status, scientific_status, uncertainty_level)
    VALUES ('x.gb.test', '2.0.0-candidate.2', 'emission_factor', 0.1, 'kg/km', 'GB', ARRAY['GB'], ARRAY['IN'],
        '2026', 's', 'b', 'CO2e', 'desnz-2026-flat', 'l', 'verified_primary', 'supported', 'low') $q$);

SELECT pg_temp.expect_error('GLOBAL proxy needs medium/high uncertainty', $q$
    INSERT INTO factor_records (factor_id, dataset_version, record_kind, value, unit, region, applies_to_regions, proxy_regions,
        applicable_year, scope, system_boundary, gases, source_id, source_locator, verification_status, scientific_status, uncertainty_level)
    VALUES ('x.global.test', '2.0.0-candidate.2', 'emission_factor', 1, 'kg CO2e/kg product', 'GLOBAL', ARRAY['GLOBAL'], ARRAY['IN'],
        '2010', 's', 'b', 'CO2e', 'owid-ghg-per-kg-poore', 'l', 'verified_secondary', 'supported', 'low') $q$);

SELECT pg_temp.expect_error('unit must carry a denominator', $q$
    INSERT INTO factor_records (factor_id, dataset_version, record_kind, value, unit, region, applies_to_regions,
        applicable_year, scope, system_boundary, gases, source_id, source_locator, verification_status, scientific_status, uncertainty_level)
    VALUES ('x.in.unitless', '2.0.0-candidate.2', 'emission_factor', 1, 'item', 'IN', ARRAY['IN'],
        '2026', 's', 'b', 'CO2', 'niti-2026-power', 'l', 'verified_primary', 'supported', 'low') $q$);

SELECT pg_temp.expect_error('dataset version cannot be activated without an approver',
    $q$ UPDATE factor_dataset_versions SET status = 'active' WHERE version = '2.0.0-candidate.2' $q$);

UPDATE factor_dataset_versions SET status = 'active', approved_by = 'test-reviewer', approved_at = now() WHERE version = '2.0.0-candidate.2';
SELECT pg_temp.expect_error('records of an active version are immutable (UPDATE)',
    $q$ UPDATE factor_records SET value = 0.45 WHERE factor_id = 'elec.grid.in.niti_annex_e.fy2024_25' $q$);
SELECT pg_temp.expect_error('records of an active version are immutable (DELETE)',
    $q$ DELETE FROM factor_records WHERE factor_id = 'elec.grid.in.niti_annex_e.fy2024_25' $q$);
INSERT INTO factor_dataset_versions (version, status) VALUES ('2.0.1-test', 'draft');
SELECT pg_temp.expect_error('only one active dataset version',
    $q$ UPDATE factor_dataset_versions SET status = 'active', approved_by = 'r', approved_at = now() WHERE version = '2.0.1-test' $q$);

SELECT pg_temp.expect_error('not_estimated mapping must name missing information', $q$
    INSERT INTO activity_factor_map (dataset_version, activity_key, region, status, quantity_unit)
    VALUES ('2.0.0-candidate.2', 'clothing_item', 'IN', 'not_estimated', 'item') $q$);
SELECT pg_temp.expect_error('estimated mapping must reference an existing factor', $q$
    INSERT INTO activity_factor_map (dataset_version, activity_key, region, factor_id, status, quantity_unit)
    VALUES ('2.0.0-candidate.2', 'home_electricity', 'IN', 'elec.grid.in.made_up', 'estimated', 'kWh') $q$);
INSERT INTO activity_factor_map (dataset_version, activity_key, region, factor_id, status, quantity_unit)
VALUES ('2.0.0-candidate.2', 'home_electricity', 'IN', 'elec.grid.in.niti_annex_e.fy2024_25', 'estimated', 'kWh');
SELECT pg_temp.expect_true('valid IN electricity mapping accepted', (SELECT count(*) = 1 FROM activity_factor_map));

-- Decision 2 accounting separation
SELECT pg_temp.expect_true('legacy logs surface as legacy_unverified, untouched',
    (SELECT bool_and(estimate_status = 'legacy_unverified') FROM v_logged_emissions));
SELECT pg_temp.expect_true('existing profiles keep region and are NOT marked confirmed',
    (SELECT bool_and(NOT region_confirmed AND region_source = 'legacy_default') FROM user_profiles));

WITH meter AS (
    INSERT INTO activity_logs (user_id, category, factor_key, label, quantity, unit, co2_kg, activity_date, factor_record_id, estimate_status)
    SELECT id, 'electricity', 'home_electricity', 'Home electricity', 42, 'kWh', 29.82, current_date, 'elec.grid.in.niti_annex_e.fy2024_25', 'estimated'
    FROM users WHERE email = 'synthetic1@example.com' RETURNING id, user_id)
INSERT INTO activity_logs (user_id, category, factor_key, label, quantity, unit, co2_kg, activity_date, factor_record_id, estimate_status, attribution_of)
SELECT user_id, 'electricity', 'air_conditioning', 'AC', 14, 'kWh', 9.94, current_date, 'elec.grid.in.niti_annex_e.fy2024_25', 'estimated', id FROM meter;
INSERT INTO activity_logs (user_id, category, factor_key, label, quantity, unit, co2_kg, activity_date, estimate_status)
SELECT id, 'shopping', 'clothing_item', 'Clothing item', 1, 'item', 0, current_date, 'not_estimated' FROM users WHERE email = 'synthetic1@example.com';
SELECT pg_temp.expect_true('appliance attribution and not_estimated logs excluded from totals', (
    SELECT sum(co2_kg) FILTER (WHERE counts_toward_total AND estimate_status <> 'legacy_unverified') = 29.82
    FROM v_logged_emissions v JOIN users u ON u.id = v.user_id WHERE u.email = 'synthetic1@example.com'));

SELECT pg_temp.expect_error('personal baseline needs >= 14 logged days', $q$
    INSERT INTO personal_baselines (user_id, scope_key, period_from, period_to, kg_per_week, days_with_logs, days_in_period)
    SELECT id, 'electricity', current_date - 27, current_date, 30, 10, 28 FROM users LIMIT 1 $q$);

-- V15 feedback + review controls
SELECT pg_temp.expect_error('feedback reasons restricted to the label set', $q$
    WITH r AS (INSERT INTO ai_responses (user_id, surface, provider, model) SELECT id, 'coach_chat', 'gemini', 'gemini-2.5-flash' FROM users LIMIT 1 RETURNING id, user_id)
    INSERT INTO ai_feedback (response_id, user_id, rating, reasons) SELECT id, user_id, -1, ARRAY['made_up_reason'] FROM r $q$);
SELECT pg_temp.expect_error('eval-linked review pairs can never be exported', $q$
    INSERT INTO ai_review_pairs (prompt_redacted, context_snapshot, response_a_text, response_b_text, preferred, reviewer, eval_case_id, export_status)
    VALUES ('q', '{}', 'a', 'b', 'A', 'r', 'GRD-001', 'approved') $q$);
SELECT pg_temp.expect_error('exported pairs need a reviewer and a strict preference', $q$
    INSERT INTO ai_review_pairs (prompt_redacted, context_snapshot, response_a_text, response_b_text, preferred, export_status)
    VALUES ('q', '{}', 'a', 'b', '=', 'approved') $q$);

-- V14 separation: the scientific corpus has no path to user data
SELECT pg_temp.expect_true('sci_* tables have no user_id column', NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name LIKE 'sci\_%' AND column_name = 'user_id'));
SELECT pg_temp.expect_true('hybrid indexes exist (HNSW + GIN)', (
    SELECT count(*) = 2 FROM pg_indexes WHERE tablename = 'sci_chunks' AND indexname IN ('ix_sci_chunks_hnsw', 'ix_sci_chunks_tsv')));

ROLLBACK;
