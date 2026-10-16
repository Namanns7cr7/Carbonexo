"""SQLAlchemy model for `user_profiles`, matching V1__baseline_schema.sql
(widened by V5__widen_profile_choice_columns.sql) and profile/UserProfile.java
exactly.

Note: Java's field initializers leave `weekly_goal_pct`/`daily_distance_km`
unset (null) rather than using the DB column defaults (15 / 0) — Hibernate
always sends explicit values on insert, so a freshly auto-created profile
gets these as None, not the SQL defaults. Mirrored here by NOT setting a
Python-side `default=` on those two columns.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, SmallInteger, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, BaseAuditMixin


class UserProfile(BaseAuditMixin, Base):
    __tablename__ = "user_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    travel_mode: Mapped[str | None] = mapped_column(String(200), nullable=True)
    daily_distance_km: Mapped[Decimal | None] = mapped_column(nullable=True)
    diet: Mapped[str | None] = mapped_column(String(200), nullable=True)
    electricity_usage: Mapped[str | None] = mapped_column(String(200), nullable=True)
    shopping_habit: Mapped[str | None] = mapped_column(String(200), nullable=True)
    weekly_goal_pct: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    region: Mapped[str] = mapped_column(String(16), nullable=False, server_default="GLOBAL", default="GLOBAL")
    onboarded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
