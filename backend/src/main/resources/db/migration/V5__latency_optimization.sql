-- ============================================================================
-- V5__latency_optimization.sql — Composite indexes for hot query paths
-- Safe and idempotent using CREATE INDEX IF NOT EXISTS
-- ============================================================================

-- Activity logs: composite index on (user_id, activity_date DESC, created_at DESC)
-- Optimized for range-scans and user timeline queries where deleted_at IS NULL
CREATE INDEX IF NOT EXISTS ix_activity_logs_user_date_created
    ON activity_logs (user_id, activity_date DESC, created_at DESC)
    WHERE deleted_at IS NULL;

-- Coach messages: composite index on (user_id, created_at DESC, id DESC)
-- Optimized for cursor-based pagination and sub-50ms infinite scroll
CREATE INDEX IF NOT EXISTS ix_coach_messages_user_created_id
    ON coach_messages (user_id, created_at DESC, id DESC);
