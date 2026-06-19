-- ============================================================================
-- V3__reference_data.sql — production-safe reference/config data
-- Emission factors, action templates, credit rules, rewards, prompt templates,
-- and runtime config. These are DATA the engines read at runtime (no hardcoding
-- in code). Source of factor values: lib/carbon.ts (existing frontend catalog).
-- Idempotent via ON CONFLICT so it can re-run safely.
-- ============================================================================

-- ---- emission factors (category, factor_key, region, effective_from unique) ----
INSERT INTO emission_factors (category, factor_key, label, emoji, unit, factor_kg_per_unit, default_qty, region, source)
VALUES
  ('travel','car_ride','Car ride','🚗','km',0.1800,10,'GLOBAL','frontend catalog'),
  ('travel','motorbike','Motorbike','🛵','km',0.1000,10,'GLOBAL','frontend catalog'),
  ('travel','bus','Bus','🚌','km',0.0800,10,'GLOBAL','frontend catalog'),
  ('travel','metro_train','Metro / Train','🚇','km',0.0400,10,'GLOBAL','frontend catalog'),
  ('travel','flight','Flight','✈️','km',0.2500,500,'GLOBAL','frontend catalog'),
  ('travel','bike','Bike','🚲','km',0.0000,5,'GLOBAL','frontend catalog'),
  ('travel','walk','Walk','🚶','km',0.0000,3,'GLOBAL','frontend catalog'),
  ('food','beef_meal','Beef meal','🥩','item',5.0000,1,'GLOBAL','frontend catalog'),
  ('food','chicken_meal','Chicken meal','🍗','item',1.2000,1,'GLOBAL','frontend catalog'),
  ('food','fish_meal','Fish meal','🐟','item',1.3000,1,'GLOBAL','frontend catalog'),
  ('food','veg_meal','Veg meal','🥗','item',0.6000,1,'GLOBAL','frontend catalog'),
  ('food','vegan_meal','Vegan meal','🌱','item',0.4000,1,'GLOBAL','frontend catalog'),
  ('food','dairy','Dairy','🧀','item',1.0000,1,'GLOBAL','frontend catalog'),
  ('food','food_delivery','Food delivery','🛵','item',0.6000,1,'GLOBAL','frontend catalog'),
  ('electricity','home_electricity','Home electricity','⚡','kWh',0.4500,4,'GLOBAL','frontend catalog'),
  ('electricity','air_conditioning','Air conditioning','❄️','kWh',0.4500,6,'GLOBAL','frontend catalog'),
  ('electricity','geyser_heater','Geyser / heater','🔥','kWh',0.4500,3,'GLOBAL','frontend catalog'),
  ('electricity','laundry_dryer','Laundry + dryer','🧺','kWh',0.4500,2,'GLOBAL','frontend catalog'),
  ('shopping','clothing_item','Clothing item','👕','item',10.0000,1,'GLOBAL','frontend catalog'),
  ('shopping','electronics','Electronics','📱','item',30.0000,1,'GLOBAL','frontend catalog'),
  ('shopping','online_order','Online order','📦','item',2.5000,1,'GLOBAL','frontend catalog'),
  ('shopping','groceries','Groceries','🛒','item',1.0000,1,'GLOBAL','frontend catalog'),
  ('waste','general_waste','General waste','🗑️','item',0.5000,1,'GLOBAL','frontend catalog'),
  ('waste','plastic_bottle','Plastic bottle','🥤','item',0.2000,1,'GLOBAL','frontend catalog'),
  ('waste','food_waste','Food waste','🍂','item',0.4000,1,'GLOBAL','frontend catalog')
ON CONFLICT (category, factor_key, region, effective_from) DO NOTHING;

-- ---- action templates (from lib/carbon.ts ACTIONS) ----
INSERT INTO action_templates (action_key, emoji, title, description, category, difficulty, saving_kg_per_week)
VALUES
  ('metro-commute','🚇','Take the metro twice a week','Swap two car commutes for the metro.','travel','Easy',8.0),
  ('meatless','🥗','Two meat-free days','Replace beef/chicken with plant meals twice weekly.','food','Easy',6.4),
  ('ac-timer','🌙','AC off 30 min earlier','Use a timer so cooling stops before you sleep.','electricity','Easy',2.1),
  ('reusable-bottle','♻️','Carry a reusable bottle','Cut single-use plastic on the go.','waste','Easy',0.8),
  ('cook-home','🍳','Cook three dinners at home','Fewer deliveries means less packaging + transport.','food','Medium',3.2),
  ('carpool','🚙','Carpool on long trips','Share rides to halve per-person travel emissions.','travel','Medium',5.5),
  ('led-swap','💡','Switch to LED bulbs','Replace the 5 bulbs you use most.','electricity','Medium',1.6),
  ('second-hand','👕','Buy one fewer new item','Choose second-hand or skip an impulse buy.','shopping','Hard',9.0)
ON CONFLICT (action_key) DO NOTHING;

-- ---- credit rules (editable without deploy) ----
INSERT INTO credit_rules (rule_key, rule_type, description, credits_per_unit, unit)
VALUES
  ('kg_saved','PER_KG_SAVED','Credits per kg CO2 saved vs baseline',10.00,'kg'),
  ('action_done','PER_ACTION_DONE','Credits when a plan action is completed',25.00,'action'),
  ('streak_day','PER_STREAK_DAY','Credits per consecutive tracking day',5.00,'day'),
  ('signup_bonus','SIGNUP_BONUS','One-time welcome credits',100.00,'event'),
  ('bill_upload','PER_BILL_UPLOAD','Credits for uploading & confirming an electricity bill',15.00,'event')
ON CONFLICT (rule_key) DO NOTHING;

-- ---- sample rewards catalog ----
INSERT INTO rewards (reward_key, title, description, cost_credits, stock, partner)
VALUES
  ('tree_plant','Plant a tree in your name','We fund a sapling via a verified reforestation partner.',200,NULL,'GreenEarth'),
  ('metro_pass','₹100 metro travel credit','Discount code for your city metro card.',500,1000,'CityMetro'),
  ('reusable_kit','Reusable bottle + bag kit','Eco starter kit shipped to you.',800,500,'EcoStore'),
  ('coffee_voucher','Sustainable cafe voucher','₹150 at partner zero-waste cafes.',350,2000,'BrewGreen'),
  ('carbon_offset','1 tonne verified carbon offset','Gold-standard offset certificate.',1500,NULL,'OffsetNow')
ON CONFLICT (reward_key) DO NOTHING;

-- ---- prompt templates (no prompts in business code) ----
INSERT INTO prompt_templates (template_key, version, body, variables, description)
VALUES
  ('reduction_recs',1,
   'You are EcoTrack''s sustainability coach. The user''s weekly footprint by category (kg CO2e) is: {{breakdown}}. Their biggest source is {{biggest_source}}. Suggest 3 specific, encouraging, non-judgmental actions with estimated weekly kg saved. Return concise JSON: [{"title":"","detail":"","est_saving_kg":0}].',
   '{"breakdown":"json","biggest_source":"string"}'::jsonb,
   'Personalized carbon-reduction recommendations'),
  ('electricity_analysis',1,
   'Analyze this electricity usage. Latest bill: {{units}} kWh for {{billing_month}}, prior months: {{history}}. Emission factor: {{factor}} kg/kWh. Explain trends in plain language and give 2 saving tips. Keep it under 120 words.',
   '{"units":"number","billing_month":"string","history":"json","factor":"number"}'::jsonb,
   'Electricity consumption analysis'),
  ('transport_insights',1,
   'The user''s travel logs this week: {{travel_logs}}. Their usual mode is {{travel_mode}}, ~{{daily_distance}} km/day. Give 2 practical transport insights and one swap idea with estimated kg saved. Under 100 words.',
   '{"travel_logs":"json","travel_mode":"string","daily_distance":"number"}'::jsonb,
   'Transportation insights'),
  ('sustainability_tip',1,
   'Give one short, motivating sustainability tip tailored to a user whose diet is {{diet}} and biggest source is {{biggest_source}}. One sentence.',
   '{"diet":"string","biggest_source":"string"}'::jsonb,
   'Daily personalized tip'),
  ('monthly_report',1,
   'Write a friendly monthly sustainability report for {{name}} covering {{period}}. Totals: {{monthly_total}} kg CO2e, change vs last month {{delta_pct}}%, credits earned {{credits}}, actions completed {{actions}}. Celebrate wins, note one focus area. Under 180 words.',
   '{"name":"string","period":"string","monthly_total":"number","delta_pct":"number","credits":"number","actions":"number"}'::jsonb,
   'Monthly sustainability report'),
  ('coach_system',1,
   'You are EcoTrack''s friendly, encouraging carbon coach. Be concise, practical, never preachy. Use the user context when relevant: {{context}}.',
   '{"context":"json"}'::jsonb,
   'System prompt for the AI coach chat')
ON CONFLICT (template_key, version) DO NOTHING;

-- ---- runtime config (non-secret defaults; secrets come from env/Key Vault) ----
INSERT INTO app_config (config_key, config_value, value_type, description, secret)
VALUES
  ('ocr.provider','tesseract','string','Active OCR provider: azure|google|tesseract',false),
  ('ai.provider','anthropic','string','Active AI provider: openai|anthropic|azure_openai',false),
  ('ai.model.default','claude-opus-4-8','string','Default AI model',false),
  ('ai.model.fast','claude-sonnet-4-6','string','Cheaper/faster AI model for light tasks',false),
  ('storage.provider','azure_blob','string','Active blob storage provider: azure_blob|local_stub',false),
  ('storage.container.bills','bills','string','Blob container for uploaded bills',false),
  ('upload.max_bytes','10485760','int','Max bill upload size in bytes (10 MB)',false),
  ('carbon.electricity_factor_default','0.45','decimal','Fallback kg CO2 per kWh when no factor row matches',false),
  ('credits.enabled','true','bool','Master switch for the green-credit engine',false)
ON CONFLICT (config_key) DO NOTHING;
