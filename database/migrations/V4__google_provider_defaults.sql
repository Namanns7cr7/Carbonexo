-- ============================================================================
-- V4__google_provider_defaults.sql — switch provider defaults to Google
-- ============================================================================

UPDATE app_config SET config_value = 'gemini'           WHERE config_key = 'ai.provider';
UPDATE app_config SET config_value = 'gemini-2.5-pro'   WHERE config_key = 'ai.model.default';
UPDATE app_config SET config_value = 'gemini-2.0-flash'  WHERE config_key = 'ai.model.fast';
UPDATE app_config SET config_value = 'gcs'              WHERE config_key = 'storage.provider';
