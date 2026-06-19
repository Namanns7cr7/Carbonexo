# Database Documentation — Carbonexo / EcoTrack

**Database:** PostgreSQL 16
**Migrations:** Flyway (database/migrations/V*.sql)
**Schema snapshot:** database/schema.sql

## Tables Overview

| Table | Purpose | PK | Soft Delete |
|-------|---------|----|----|
| `users` | Application users | UUID | ✅ |
| `refresh_tokens` | Rotating refresh token hashes | UUID | ✗ |
| `user_profiles` | User carbon profile | UUID | ✅ |
| `emission_factors` | Carbon emission factors (config data) | UUID | ✗ |
| `activity_logs` | Daily tracked activities | UUID | ✅ |
| `bills` | Uploaded electricity bills | UUID | ✅ |
| `ocr_results` | OCR extraction results | UUID | ✗ |
| `action_templates` | Recommended actions catalog | UUID | ✗ |
| `user_plans` | User's adopted action plans | UUID | ✅ |
| `prompt_templates` | AI prompt templates | UUID | ✗ |
| `recommendations` | AI-generated recommendations | UUID | ✗ |
| `coach_messages` | AI coach chat messages | UUID | ✗ |
| `credit_rules` | Configurable credit rules | UUID | ✗ |
| `credit_ledger` | Append-only credit transactions | UUID | ✗ (immutable) |
| `rewards` | Reward catalog | UUID | ✅ |
| `redemptions` | Reward redemptions | UUID | ✗ |
| `app_config` | Runtime configuration | UUID | ✗ |
| `audit_log` | Audit trail | UUID | ✗ (append-only) |

## Conventions

- **UUID v4** primary keys (PostgreSQL `gen_random_uuid()`)
- **Audit columns**: `created_at`, `updated_at`, `created_by`, `updated_by`
- **Soft delete**: `deleted_at` on user-owned mutable entities
- **Immutable tables**: `credit_ledger`, `audit_log` — no update/delete
- **`updated_at` trigger**: Maintained by `set_updated_at()` function
- **Enums**: VARCHAR + CHECK constraints for forward-compatibility

## Key Relationships

```
users ──1:1──► user_profiles
users ──1:N──► activity_logs
users ──1:N──► bills ──1:1──► ocr_results
users ──1:N──► credit_ledger
users ──1:N──► redemptions ──N:1──► rewards
users ──1:N──► user_plans ──N:1──► action_templates
users ──1:N──► recommendations
users ──1:N──► coach_messages
activity_logs ──N:1──► bills (optional)
```

## Migration History

| Version | Description |
|---------|-------------|
| V1 | Baseline schema — all tables |
| V2 | Performance indexes |
| V3 | Reference data (factors, rules, rewards, templates, config) |
| V4 | Google provider defaults |
