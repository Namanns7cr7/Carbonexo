# Carbonexo / EcoTrack — Database

PostgreSQL 16. Layout:

```
database/
├── schema.sql        # human-readable full snapshot of the schema
├── indexes.sql       # standalone index script (mirrors V2)
├── seed.sql          # DEV/DEMO data only (demo user "Yash" matching the design mock)
├── migrations/       # Flyway — EXECUTABLE source of truth (ordered)
│   ├── V1__baseline_schema.sql
│   ├── V2__indexes.sql
│   └── V3__reference_data.sql   # factors, actions, credit rules, rewards, prompts, config
└── docker-compose.yml
```

## Quick start (local)

```bash
# 1. start Postgres
docker compose -f database/docker-compose.yml up -d

# 2. apply migrations — either let the Spring Boot backend run Flyway on boot,
#    or use the Flyway CLI:
flyway -url=jdbc:postgresql://localhost:5432/ecotrack -user=ecotrack -password=ecotrack \
       -locations=filesystem:database/migrations migrate

# 3. (dev only) load demo data
psql postgresql://ecotrack:ecotrack@localhost:5432/ecotrack -f database/seed.sql
```

`schema.sql` + `indexes.sql` can apply the whole schema in one shot **without** Flyway
(useful for a quick throwaway DB): `psql ... -f database/schema.sql -f database/indexes.sql`.

## Conventions
- **UUID** primary keys (`gen_random_uuid()`, via `pgcrypto`).
- **Audit columns** `created_at/updated_at/created_by/updated_by` on mutable tables; `updated_at` maintained by the `set_updated_at()` trigger.
- **Soft delete** (`deleted_at`) on user-owned mutable entities. Append-only tables (`credit_ledger`, `audit_log`) are immutable — no soft delete.
- **No hardcoded business values:** emission factors, credit rules, rewards, prompt templates and runtime config are **data** (see `V3`), read by the engines at runtime.

## Demo login (after seed.sql)
`yash@ecotrack.dev` / `password` — replace the bcrypt hash before any non-local use.

See `DATABASE_DOCUMENTATION.md` (Phase 13) for the full table-by-table reference.
