"""SQLAlchemy 2.0 declarative base + the shared audit-column mixin.

Mirrors com.ecotrack.common.BaseEntity: every audited table gets
`id` (UUID, server-generated), `created_at`/`updated_at` (timestamptz,
maintained by the app and backstopped by a DB trigger), and nullable
`created_by`/`updated_by` (UUID of the acting user, when known).

`deleted_at` is NOT part of this mixin — add it per-model only for the
tables that actually have the column in V1__baseline_schema.sql (checked
against the SQL, not assumed): users, user_profiles, activity_logs, bills,
user_plans, rewards, redemptions. Tables such as emission_factors,
ocr_results, action_templates, prompt_templates, credit_rules,
credit_ledger, app_config, audit_log, coach_messages and recommendations
have no deleted_at column and must not declare one.

`refresh_tokens` does not use this mixin at all — per RefreshToken.java it's
an append/rotate-only table with just `created_at` (no updated_at/audit cols).
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def _utcnow() -> datetime:

    return datetime.now(UTC)


class BaseAuditMixin:
    """Mixin matching BaseEntity.java's id/created_at/updated_at/created_by/updated_by.

    Both a Python-side `default` and a DB-side `server_default` are declared
    for id/created_at/updated_at: `default` mirrors Hibernate's
    GenerationType.UUID (the JPA entity assigns its own id in the app layer,
    same as @CreatedDate auditing assigns timestamps in the app layer) and
    also makes the ORM layer portable to SQLite (used by non-Postgres-specific
    unit tests); `server_default` mirrors the SQL schema's own
    `DEFAULT gen_random_uuid()` / `DEFAULT now()`, which exists as a safety net
    for any insert that bypasses the ORM.
    """

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        server_default=text("now()"),
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
