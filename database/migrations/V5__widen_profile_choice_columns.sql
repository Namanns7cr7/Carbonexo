-- Allow multi-select onboarding answers (stored comma-separated) by widening the
-- profile choice columns from VARCHAR(40) to VARCHAR(200).
ALTER TABLE user_profiles ALTER COLUMN travel_mode       TYPE VARCHAR(200);
ALTER TABLE user_profiles ALTER COLUMN diet              TYPE VARCHAR(200);
ALTER TABLE user_profiles ALTER COLUMN electricity_usage TYPE VARCHAR(200);
ALTER TABLE user_profiles ALTER COLUMN shopping_habit    TYPE VARCHAR(200);
