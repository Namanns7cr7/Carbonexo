-- ============================================================================
-- V8__ai_insight_prompt_templates.sql — deepen Gen AI usage across the
-- simulation, embodied-carbon, and social/groups features.
--
-- All three numeric pipelines (simulation deltas, embodied-carbon kg CO2e,
-- leaderboard ranks/values) stay 100% deterministic and DB-driven — these
-- templates only ever generate narrative/explanatory text layered on top of
-- numbers the backend already computed, never the numbers themselves.
-- Same INSERT shape as V7's `embodied_carbon_alt_tip` row. Idempotent via
-- ON CONFLICT so it can re-run safely.
-- ============================================================================

INSERT INTO prompt_templates (template_key, version, body, variables, description)
VALUES
  ('simulation_insight',1,
   'A user is testing a hypothetical scenario in a carbon-footprint simulation that projects habit changes forward in time. Over a {{horizon}} horizon, the projected shift is {{delta_kg}} kg CO2e, putting them at {{projected_progress_pct}}% of their weekly goal and worth about {{projected_credits}} credits. In 1-2 short, motivating sentences (max 40 words) using only these numbers, explain what this scenario would mean for them. Plain text, no markdown.',
   '{"delta_kg":"string","projected_progress_pct":"string","projected_credits":"string","horizon":"string"}'::jsonb,
   'Short motivational/explanatory insight for a carbon-twin simulation result'),

  ('embodied_carbon_persuasion',1,
   'A user is about to buy a product in the "{{category}}" category{{product_hint}}. A lower-carbon alternative is available: {{alt_label}}, estimated to save about {{kg_saved}} kg CO2e. Write one persuasive, encouraging sentence (max 30 words) that motivates them to choose the alternative, referencing the savings number given. Plain text, no markdown.',
   '{"category":"string","product_hint":"string","alt_label":"string","kg_saved":"string"}'::jsonb,
   'Persuasive one-line "why switch" copy for the seeded lower-carbon alternative path'),

  ('group_leaderboard_summary',1,
   'Group "{{group_name}}" just finished ranking its {{member_count}} members on a {{window}} leaderboard for {{metric}}. The top performer is {{top_performer}} with {{top_value}}. Write one short, warm, encouraging summary sentence (max 30 words) for the whole group that celebrates the leader and motivates the rest. Plain text, no markdown.',
   '{"group_name":"string","top_performer":"string","top_value":"string","metric":"string","window":"string","member_count":"string"}'::jsonb,
   'Short encouraging summary sentence for a group leaderboard result')
ON CONFLICT (template_key, version) DO NOTHING;
