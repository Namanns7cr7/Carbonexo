"""Pydantic DTOs matching credit/dto/*.java field-for-field (camelCase on the
wire via populate_by_name + serialization aliases, same pattern as auth/schemas.py).
"""
from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class CreditBalanceResponse(BaseModel):
    user_id: uuid.UUID = Field(serialization_alias="userId")
    balance: int

    model_config = {"populate_by_name": True}


class CreditHistoryResponse(BaseModel):
    id: uuid.UUID
    delta: int
    balance_after: int = Field(serialization_alias="balanceAfter")
    reason: str
    rule_key: str | None = Field(default=None, serialization_alias="ruleKey")
    ref_type: str | None = Field(default=None, serialization_alias="refType")
    created_at: str = Field(serialization_alias="createdAt")

    model_config = {"populate_by_name": True}
