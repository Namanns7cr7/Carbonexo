"""SQLAlchemy models for `credit_rules` and `credit_ledger`, matching
V1__baseline_schema.sql and credit/{CreditRule,CreditLedger}.java exactly.

CreditRule extends BaseAuditMixin (id/created_at/updated_at/created_by/updated_by
via JPA auditing in Java) — it DOES use the standard audit mixin.

CreditLedger is a plain entity (append-only, immutable ledger) — it does NOT
use BaseAuditMixin: no updated_at/updated_by columns exist at all, and
created_by is set manually to the awarded/debited user id (not via auditing).
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, Integer, Numeric, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, BaseAuditMixin, _utcnow


class CreditRule(BaseAuditMixin, Base):
    __tablename__ = "credit_rules"

    rule_key: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    rule_type: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)
    credits_per_unit: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)


class CreditLedger(Base):
    """Append-only credit ledger — immutable, no update/delete/soft-delete.

    Balance is always `COALESCE(SUM(delta), 0)` over this table for a user;
    `balance_after` is only a point-in-time snapshot for history display.
    """

    __tablename__ = "credit_ledger"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(200), nullable=False)
    rule_key: Mapped[str | None] = mapped_column(String(60), nullable=True)
    ref_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    ref_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, server_default=text("now()")
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
