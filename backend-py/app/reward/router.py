"""Reward endpoints (authenticated) — mirrors reward/RewardController.java
paths and status codes exactly: GET '', POST /{id}/redeem (201), GET /redemptions.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.security_deps import UserPrincipal, get_current_user
from app.db.session import get_db
from app.reward.schemas import RedemptionResponse, RewardResponse
from app.reward.service import RewardService

router = APIRouter(prefix="/api/rewards", tags=["Rewards"])


@router.get("", response_model=list[RewardResponse])
async def get_rewards(db: AsyncSession = Depends(get_db)) -> list[RewardResponse]:
    return await RewardService(db).get_catalog()


@router.get("/redemptions", response_model=list[RedemptionResponse])
async def get_redemptions(
    user: UserPrincipal = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[RedemptionResponse]:
    return await RewardService(db).get_redemptions(user.user_id)


@router.post("/{reward_id}/redeem", response_model=RedemptionResponse, status_code=status.HTTP_201_CREATED)
async def redeem_reward(
    reward_id: uuid.UUID,
    user: UserPrincipal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RedemptionResponse:
    return await RewardService(db).redeem(user.user_id, reward_id)
