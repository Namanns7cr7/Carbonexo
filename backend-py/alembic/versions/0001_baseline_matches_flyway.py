"""Baseline schema — runs the literal, unmodified SQL from
database/migrations/V1__baseline_schema.sql through V5 (in order) so the
schema stays byte-identical to what Flyway already applied in any existing
environment, rather than re-deriving DDL from the ORM models. Lets
`alembic stamp head` apply cleanly to already-Flyway-migrated DBs, and lets
a fresh dev DB bootstrap identically.

Revision ID: 0001
Revises:
Create Date: 2026-10-14
"""
from __future__ import annotations

from pathlib import Path

from alembic import op

# revision identifiers, used by Alembic.
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

# Resolved relative to THIS file so it works regardless of cwd.
_MIGRATIONS_DIR = Path(__file__).resolve().parents[3] / "database" / "migrations"

_FILES = [
    "V1__baseline_schema.sql",
    "V2__indexes.sql",
    "V3__reference_data.sql",
    "V4__google_provider_defaults.sql",
    "V5__widen_profile_choice_columns.sql",
]


def upgrade() -> None:
    for filename in _FILES:
        sql_path = _MIGRATIONS_DIR / filename
        sql_text = sql_path.read_text(encoding="utf-8")
        op.execute(sql_text)


def downgrade() -> None:
    raise NotImplementedError(
        "Baseline migration has no downgrade — it mirrors Flyway's forward-only "
        "V1-V5 migrations verbatim. Restore from a DB snapshot instead."
    )
