"""SQLAlchemy models for `bills` and `ocr_results`, matching
V1__baseline_schema.sql and bill/{Bill,OcrResult}.java exactly.

Bill uses BaseAuditMixin + `deleted_at` (soft-delete). OcrResult uses
BaseAuditMixin but has NO `deleted_at` column.

Status enum values actually USED by BillService: UPLOADED -> OCR_PENDING ->
OCR_DONE -> CONFIRMED. The DB CHECK constraint also allows SCANNED and FAILED
but current BillService.java code never sets either — don't invent
transitions to them.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import JSON, BigInteger, Boolean, Date, DateTime, Numeric, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, BaseAuditMixin


class Bill(BaseAuditMixin, Base):
    __tablename__ = "bills"

    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    blob_container: Mapped[str] = mapped_column(String(120), nullable=False)
    blob_path: Mapped[str] = mapped_column(String(500), nullable=False)
    blob_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String(300), nullable=True)
    content_type: Mapped[str] = mapped_column(String(80), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    content_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="UPLOADED", server_default="UPLOADED")
    billing_month: Mapped[date | None] = mapped_column(Date, nullable=True)
    units_consumed: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    bill_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(8), nullable=True, server_default="INR")
    scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(String(400), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class OcrResult(BaseAuditMixin, Base):
    __tablename__ = "ocr_results"

    bill_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    provider: Mapped[str] = mapped_column(String(40), nullable=False)
    raw_json: Mapped[str | None] = mapped_column(JSONB().with_variant(JSON(), "sqlite"), nullable=True)
    parsed_billing_month: Mapped[date | None] = mapped_column(Date, nullable=True)
    parsed_units: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    parsed_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    corrected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    corrected_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    corrected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
