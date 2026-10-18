-- Deterministic synthetic population for the Decision 2 impact report. LOCAL TEST DATABASES ONLY.
-- 300 users, accounts 30-180 days old, five logging-habit buckets, legacy factor values.
SELECT setseed(0.42);

CREATE TEMP TABLE synth AS
SELECT gs AS n,
       ('00000000-0000-4000-8000-' || lpad(gs::text, 12, '0'))::uuid AS user_id,
       (30 + floor(random() * 150))::int AS age_days,
       (ARRAY[0.0, 0.1, 0.3, 0.6, 0.9])[1 + (gs % 5)] AS log_prob
FROM generate_series(1, 300) gs;

INSERT INTO users (id, email, password_hash, role, status, created_at)
SELECT user_id, 'synthetic' || n || '@example.com', 'x', 'USER', 'ACTIVE', now() - make_interval(days => age_days)
FROM synth;

INSERT INTO user_profiles (user_id, name, weekly_goal_pct, region, onboarded)
SELECT user_id, 'Synthetic ' || n, 15, 'GLOBAL', TRUE FROM synth;

-- One row per logged day per activity, using legacy factors (car 0.18/km, home electricity 0.45/kWh, veg meal 0.6).
-- The random draw lives inside the per-day LATERAL: a bare `WHERE random() < s.log_prob` only references
-- synth columns, so the planner pushes it to the synth scan and draws ONCE PER USER (all-or-nothing logging).
INSERT INTO activity_logs (user_id, category, factor_key, label, quantity, unit, co2_kg, activity_date, source)
SELECT s.user_id, a.category, a.factor_key, a.label, a.qty, a.unit, round((a.qty * a.factor)::numeric, 3), d.day, 'manual'
FROM synth s
CROSS JOIN LATERAL (SELECT g::date AS day, random() AS r
                    FROM generate_series(current_date - s.age_days, current_date, interval '1 day') g) AS d
CROSS JOIN (VALUES ('travel','car_ride','Car ride',12.0,'km',0.18),
                   ('electricity','home_electricity','Home electricity',6.0,'kWh',0.45),
                   ('food','veg_meal','Veg meal',2.0,'item',0.6)) AS a(category, factor_key, label, qty, unit, factor)
WHERE d.r < s.log_prob;

-- Credits exactly as the backend awards them today: signup + some action completions + some bill uploads.
INSERT INTO credit_ledger (user_id, delta, balance_after, reason, rule_key, ref_type, created_at)
SELECT user_id, 100, 100, 'Welcome bonus', 'signup_bonus', 'signup', now() - make_interval(days => age_days) FROM synth;
INSERT INTO credit_ledger (user_id, delta, balance_after, reason, rule_key, ref_type, created_at)
SELECT user_id, 25, 125, 'Action completed', 'action_done', 'action', now() - make_interval(days => age_days / 2)
FROM synth WHERE n % 3 = 0;
INSERT INTO credit_ledger (user_id, delta, balance_after, reason, rule_key, ref_type, created_at)
SELECT user_id, 15, 140, 'Bill uploaded & confirmed', 'bill_upload', 'bill', now() - make_interval(days => age_days / 3)
FROM synth WHERE n % 4 = 0;
