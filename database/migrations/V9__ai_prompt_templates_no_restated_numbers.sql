-- ============================================================================
-- V9__ai_prompt_templates_no_restated_numbers.sql
--
-- Bug found via live testing: asking Gemini to restate a given number back
-- in its generated sentence is unreliable — observed "save 70,000 kg CO2e"
-- generated from an input of 70 kg CO2e (a 1000x mangling of the exact
-- figure it was handed). The deterministic numbers are already shown
-- separately in the UI (breakdown stats, "~X kg CO2e instead", leaderboard
-- values), so there's no need for the AI text to repeat them at all.
--
-- Fix: supersede each V8 template with a version-2 row (findLatestActiveByKey
-- picks the highest active version) that explicitly instructs the model to
-- write purely qualitative/motivational text and NOT include any numbers,
-- figures, or quantities — eliminating this entire class of bug rather than
-- trying to make number-restatement more reliable.
-- ============================================================================

INSERT INTO prompt_templates (template_key, version, body, variables, description)
VALUES
  ('simulation_insight',2,
   'A user is testing a hypothetical scenario in a carbon-footprint simulation that projects habit changes forward in time, over a {{horizon}} horizon. In 1-2 short, motivating sentences (max 35 words), explain what a change like this generally means for their footprint and weekly goal progress. Do NOT include any specific numbers, percentages, or figures in your sentence — those are already shown separately in the UI; keep it purely qualitative and encouraging. Plain text, no markdown.',
   '{"delta_kg":"string","projected_progress_pct":"string","projected_credits":"string","horizon":"string"}'::jsonb,
   'Short motivational/explanatory insight for a carbon-twin simulation result (number-free, v2)'),

  ('embodied_carbon_persuasion',2,
   'A user is about to buy a product in the "{{category}}" category{{product_hint}}. A lower-carbon alternative is available: {{alt_label}}. Write one persuasive, encouraging sentence (max 25 words) that motivates them to choose the alternative. Do NOT include any specific numbers, percentages, or quantities in your sentence — the savings figure is already shown separately in the UI; keep it purely qualitative. Plain text, no markdown.',
   '{"category":"string","product_hint":"string","alt_label":"string","kg_saved":"string"}'::jsonb,
   'Persuasive one-line "why switch" copy for the seeded lower-carbon alternative path (number-free, v2)'),

  ('group_leaderboard_summary',2,
   'Group "{{group_name}}" just finished ranking its members on a {{window}} leaderboard for {{metric}}. The top performer is {{top_performer}}. Write one short, warm, encouraging summary sentence (max 25 words) for the whole group that celebrates the leader and motivates the rest. Do NOT include any specific numbers or figures in your sentence — those are already shown separately in the UI; keep it purely qualitative. Plain text, no markdown.',
   '{"group_name":"string","top_performer":"string","top_value":"string","metric":"string","window":"string","member_count":"string"}'::jsonb,
   'Short encouraging summary sentence for a group leaderboard result (number-free, v2)')
ON CONFLICT (template_key, version) DO NOTHING;
