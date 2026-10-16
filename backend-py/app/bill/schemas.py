"""Pydantic DTOs matching bill/dto/*.java field-for-field, and the frontend's
`BillData` in lib/api/bills.ts exactly (camelCase wire shape).
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from pydantic import BaseModel, Field


class BillCorrectionRequest(BaseModel):
    billing_month: str | None = Field(default=None, alias="billingMonth")  # "YYYY-MM"
    units_consumed: Decimal | None = Field(default=None, alias="unitsConsumed")
    bill_amount: Decimal | None = Field(default=None, alias="billAmount")

    model_config = {"populate_by_name": True}


class BillResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID = Field(serialization_alias="userId")
    blob_url: str | None = Field(default=None, serialization_alias="blobUrl")
    original_filename: str | None = Field(default=None, serialization_alias="originalFilename")
    content_type: str = Field(serialization_alias="contentType")
    size_bytes: int = Field(serialization_alias="sizeBytes")
    status: str
    billing_month: str | None = Field(default=None, serialization_alias="billingMonth")
    units_consumed: Decimal | None = Field(default=None, serialization_alias="unitsConsumed")
    bill_amount: Decimal | None = Field(default=None, serialization_alias="billAmount")
    currency: str | None = None
    created_at: str | None = Field(default=None, serialization_alias="createdAt")

    model_config = {"populate_by_name": True}
