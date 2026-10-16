"""Pydantic DTOs matching carbon/dto/*.java field-for-field (camelCase wire
shape), plus the frontend's lib/api/{activities,dashboard}.ts contracts.
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from pydantic import BaseModel, Field


class ActivityLogRequest(BaseModel):
    category: str = Field(min_length=1)
    factor_key: str | None = Field(default=None, alias="factorKey")
    label: str = Field(min_length=1)
    emoji: str | None = None
    quantity: Decimal | None = None
    unit: str | None = None
    co2_kg: Decimal = Field(alias="co2Kg", gt=0)
    note: str | None = None
    activity_date: str = Field(alias="activityDate", min_length=1)  # "YYYY-MM-DD"

    model_config = {"populate_by_name": True}


class ActivityLogResponse(BaseModel):
    id: uuid.UUID
    category: str
    factor_key: str | None = Field(default=None, serialization_alias="factorKey")
    label: str
    emoji: str | None = None
    quantity: Decimal | None = None
    unit: str | None = None
    co2_kg: Decimal = Field(serialization_alias="co2Kg")
    note: str | None = None
    activity_date: str = Field(serialization_alias="activityDate")
    source: str

    model_config = {"populate_by_name": True}


class EmissionFactorResponse(BaseModel):
    id: uuid.UUID
    category: str
    factor_key: str = Field(serialization_alias="factorKey")
    label: str
    emoji: str | None = None
    unit: str
    factor_kg_per_unit: Decimal = Field(serialization_alias="factorKgPerUnit")
    default_qty: Decimal = Field(serialization_alias="defaultQty")

    model_config = {"populate_by_name": True}


class DayTotal(BaseModel):
    date: str
    total: float


class DashboardResponse(BaseModel):
    today_total: float = Field(serialization_alias="todayTotal")
    yesterday_total: float = Field(serialization_alias="yesterdayTotal")
    delta_pct: int = Field(serialization_alias="deltaPct")
    today_breakdown: dict[str, float] = Field(serialization_alias="todayBreakdown")
    week_breakdown: dict[str, float] = Field(serialization_alias="weekBreakdown")
    week_totals: list[DayTotal] = Field(serialization_alias="weekTotals")
    biggest_category: str | None = Field(default=None, serialization_alias="biggestCategory")
    biggest_value: float = Field(serialization_alias="biggestValue")
    streak: int
    total_saved: float = Field(serialization_alias="totalSaved")
    today_logs: list[ActivityLogResponse] = Field(serialization_alias="todayLogs")

    model_config = {"populate_by_name": True}
