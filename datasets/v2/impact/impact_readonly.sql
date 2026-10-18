-- ============================================================================
-- Decision 2 impact report - READ-ONLY. Safe on a production snapshot / read replica:
-- SELECT statements only, inside a READ ONLY transaction. Requires approval to run on prod data.
--
-- Reproduces the CURRENT "CO2 saved" maths (CarbonCalculationService.carbonSaved with the fixed
-- 8.0 kg/day baseline used by DashboardService, ReportService and GroupService) and decomposes it:
--   old_saved = 8*D - E = 8*(D - L)      <- "unlogged-day component": credit for days with NO logs
--                       + (8*L - E)      <- "logged-day component": baseline minus logged kg on logged days
-- (before the max(0, .) clamp). D = days in window, L = days with >= 1 log, E = logged kg.
-- ============================================================================
BEGIN TRANSACTION READ ONLY;

WITH params AS (SELECT current_date AS as_of, 8.0::numeric AS baseline),
u AS (
    SELECT us.id AS user_id, (us.created_at AT TIME ZONE 'UTC')::date AS start_date,
           date_trunc('month', p.as_of)::date AS month_start, p.as_of, p.baseline,
           EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = us.id AND up.deleted_at IS NULL) AS has_profile
    FROM users us CROSS JOIN params p WHERE us.deleted_at IS NULL
),
w AS (
    SELECT u.*,
           (u.as_of - u.start_date + 1) AS d_life,
           (u.as_of - u.month_start + 1) AS d_month,
           (SELECT count(DISTINCT activity_date) FROM activity_logs a WHERE a.user_id = u.user_id AND a.deleted_at IS NULL AND a.activity_date BETWEEN u.start_date AND u.as_of) AS l_life,
           (SELECT coalesce(sum(co2_kg), 0) FROM activity_logs a WHERE a.user_id = u.user_id AND a.deleted_at IS NULL AND a.activity_date BETWEEN u.start_date AND u.as_of) AS e_life,
           (SELECT count(DISTINCT activity_date) FROM activity_logs a WHERE a.user_id = u.user_id AND a.deleted_at IS NULL AND a.activity_date BETWEEN u.month_start AND u.as_of) AS l_month,
           (SELECT coalesce(sum(co2_kg), 0) FROM activity_logs a WHERE a.user_id = u.user_id AND a.deleted_at IS NULL AND a.activity_date BETWEEN u.month_start AND u.as_of) AS e_month,
           (SELECT count(DISTINCT activity_date) FROM activity_logs a WHERE a.user_id = u.user_id AND a.deleted_at IS NULL AND a.activity_date BETWEEN u.as_of - 27 AND u.as_of) AS l_28d,
           (SELECT coalesce(sum(delta), 0) FROM credit_ledger c WHERE c.user_id = u.user_id) AS credit_balance,
           (SELECT count(*) FROM credit_ledger c WHERE c.user_id = u.user_id AND c.rule_key = 'kg_saved') AS kg_saved_ledger_rows
    FROM u
),
per_user AS (
    SELECT w.*,
           greatest(0, w.baseline * w.d_life - w.e_life)                                    AS old_esg_lifetime_saved,
           CASE WHEN w.has_profile THEN greatest(0, w.baseline * w.d_month - w.e_month) END AS old_dashboard_month_saved,
           w.baseline * (w.d_life - w.l_life)                                                AS unlogged_day_component,
           w.baseline * w.l_life - w.e_life                                                  AS logged_day_component,
           (w.l_28d >= 14)                                                                   AS eligible_personal_baseline
    FROM w
)
SELECT
    count(*)                                                                    AS users,
    count(*) FILTER (WHERE l_life = 0)                                          AS users_never_logged,
    round(avg(l_life::numeric / d_life), 3)                                     AS mean_logging_coverage,
    round(sum(old_esg_lifetime_saved), 1)                                       AS old_total_lifetime_saved_kg,
    count(*) FILTER (WHERE old_esg_lifetime_saved > 0)                          AS users_shown_positive_lifetime_saved,
    count(*) FILTER (WHERE l_life = 0 AND old_esg_lifetime_saved > 0)           AS users_shown_saved_with_zero_logs,
    round(sum(old_esg_lifetime_saved) FILTER (WHERE l_life = 0), 1)             AS lifetime_saved_kg_from_users_with_zero_logs,
    round(sum(unlogged_day_component), 1)                                       AS unlogged_day_component_kg,
    round(sum(logged_day_component), 1)                                         AS logged_day_component_kg,
    round(100 * sum(unlogged_day_component) / nullif(sum(unlogged_day_component) + greatest(sum(logged_day_component), 0), 0), 1)
                                                                                AS pct_of_gross_saved_from_unlogged_days,
    round(sum(old_dashboard_month_saved), 1)                                    AS old_total_month_saved_kg,
    count(*) FILTER (WHERE eligible_personal_baseline)                          AS users_eligible_for_personal_baseline_v2,
    sum(credit_balance)                                                         AS total_credit_balance_unchanged,
    sum(kg_saved_ledger_rows)                                                   AS ledger_rows_from_kg_saved_rule
FROM per_user;

-- Decision 1 preview (what-if only, nothing is rewritten): legacy 0.45 electricity logs re-priced at
-- the candidate IN factor 0.710 kg CO2/kWh for users who have CONFIRMED region IN.
-- Pre-V13 databases have no region_confirmed column, so this preview counts all electricity logs
-- and reports them as "if every account confirmed IN".
SELECT count(*)                                     AS electricity_logs,
       round(sum(co2_kg), 1)                        AS stored_kg_at_legacy_factor,
       round(sum(co2_kg) * (0.710 / 0.45), 1)       AS preview_kg_at_in_factor,
       round(sum(co2_kg) * (0.710 / 0.45 - 1), 1)   AS preview_delta_kg
FROM activity_logs
WHERE deleted_at IS NULL AND category = 'electricity';

ROLLBACK;
