"""Pydantic DTOs matching profile/dto/*.java field-for-field, and the
frontend's `ProfileData` in lib/api/profile.ts exactly (camelCase wire shape).
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from pydantic import BaseModel, Field


class ProfileRequest(BaseModel):
    """Every field independently nullable/optional — PUT applies only the
    non-null ones (PATCH-like semantics despite being a PUT), matching
    UserProfileService.createOrUpdate exactly.
    """

    name: str | None = Field(default=None, max_length=120)
    travel_mode: str | None = Field(default=None, alias="travelMode", max_length=200)
    daily_distance_km: Decimal | None = Field(default=None, alias="dailyDistanceKm")
    diet: str | None = Field(default=None, max_length=200)
    electricity_usage: str | None = Field(default=None, alias="electricityUsage", max_length=200)
    shopping_habit: str | None = Field(default=None, alias="shoppingHabit", max_length=200)
    weekly_goal_pct: int | None = Field(default=None, alias="weeklyGoalPct", ge=0, le=100)
    onboarded: bool | None = None

    model_config = {"populate_by_name": True}


class ProfileResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID = Field(serialization_alias="userId")
    name: str | None = None
    travel_mode: str | None = Field(default=None, serialization_alias="travelMode")
    daily_distance_km: Decimal | None = Field(default=None, serialization_alias="dailyDistanceKm")
    diet: str | None = None
    electricity_usage: str | None = Field(default=None, serialization_alias="electricityUsage")
    shopping_habit: str | None = Field(default=None, serialization_alias="shoppingHabit")
    weekly_goal_pct: int | None = Field(default=None, serialization_alias="weeklyGoalPct")
    region: str
    onboarded: bool

    model_config = {"populate_by_name": True}
