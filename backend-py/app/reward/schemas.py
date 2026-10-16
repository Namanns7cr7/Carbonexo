"""Pydantic DTOs matching reward/dto/*.java field-for-field, and the
frontend's `RewardData`/`RedemptionData` in lib/api/rewards.ts exactly.
"""
from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class RewardResponse(BaseModel):
    id: uuid.UUID
    reward_key: str = Field(serialization_alias="rewardKey")
    title: str
    description: str | None = None
    cost_credits: int = Field(serialization_alias="costCredits")
    stock: int | None = None
    partner: str | None = None
    image_url: str | None = Field(default=None, serialization_alias="imageUrl")

    model_config = {"populate_by_name": True}


class RedemptionResponse(BaseModel):
    id: uuid.UUID
    reward_id: uuid.UUID = Field(serialization_alias="rewardId")
    reward_title: str = Field(serialization_alias="rewardTitle")
    cost_credits: int = Field(serialization_alias="costCredits")
    status: str
    created_at: str | None = Field(default=None, serialization_alias="createdAt")

    model_config = {"populate_by_name": True}
