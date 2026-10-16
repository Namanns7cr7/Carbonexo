"""SQLAlchemy models for `emission_factors` and `activity_logs`, matching
V1__baseline_schema.sql and carbon/{EmissionFactor,ActivityLog}.java exactly.

EmissionFactor has no `deleted_at` (hard rows; "inactive" is expressed via the
`active` flag + effective-date window, never deletion) but otherwise has the
same id/created_at/updated_at/created_by/updated_by shape as BaseAuditMixin.

ActivityLog uses BaseAuditMixin AND has `deleted_at` (soft-delete; see
db/base.py's note that activity_logs is one of the tables that adds it).
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, Numeric, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, BaseAuditMixin


class EmissionFactor(BaseAuditMixin, Base):
    __tablename__ = "emission_factors"

    category: Mapped[str] = mapped_column(String(20), nullable=False)
    factor_key: Mapped[str] = mapped_column(String(60), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    emoji: Mapped[str | None] = mapped_column(String(16), nullable=True)
    unit: Mapped[str] = mapped_column(String(12), nullable=False)
    factor_kg_per_unit: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    default_qty: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True, server_default=text("1"))
    region: Mapped[str] = mapped_column(String(16), nullable=False, server_default="GLOBAL")
    source: Mapped[str | None] = mapped_column(String(200), nullable=True)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False, server_default=text("CURRENT_DATE"))
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))


class ActivityLog(BaseAuditMixin, Base):
    __tablename__ = "activity_logs"

    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    factor_key: Mapped[str | None] = mapped_column(String(60), nullable=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    emoji: Mapped[str | None] = mapped_column(String(16), nullable=True)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(12), nullable=True)
    co2_kg: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    activity_date: Mapped[date] = mapped_column(Date, nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False, server_default="manual")
    bill_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
