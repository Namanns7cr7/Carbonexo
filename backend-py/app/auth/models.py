"""SQLAlchemy models for `users` and `refresh_tokens`, matching
V1__baseline_schema.sql and user/User.java + auth/RefreshToken.java exactly.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, BaseAuditMixin, _utcnow


class User(BaseAuditMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, server_default="USER")
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="ACTIVE")
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # users DOES have deleted_at per V1__baseline_schema.sql (soft-delete, unique
    # active-email index is `WHERE deleted_at IS NULL`).
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RefreshToken(Base):
    """Append/rotate-only table — no BaseAuditMixin (no updated_at/created_by/
    updated_by columns in the SQL schema; matches RefreshToken.java exactly).
    """

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    replaced_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("refresh_tokens.id"), nullable=True
    )
    user_agent: Mapped[str | None] = mapped_column(String(400), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, server_default=text("now()")
    )

    def is_active(self, now: datetime | None = None) -> bool:

        now = now or datetime.now(UTC)
        expires_at = self.expires_at
        # SQLite (used by non-Postgres-specific unit tests) round-trips
        # DateTime(timezone=True) values as naive; treat a naive value as UTC
        # rather than raising on a naive/aware comparison (Postgres always
        # returns aware timestamptz values, so this only matters for tests).
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        return self.revoked_at is None and expires_at > now
