"""RewardService — exact port of reward/RewardService.java: catalog listing,
redeem() (debit credits via CreditService, decrement stock, create a
Redemption row — all inside one atomic DB transaction), and redemption
history.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import BadRequestException, ResourceNotFoundException
from app.credit.service import CreditService
from app.reward.models import Redemption, Reward
from app.reward.schemas import RedemptionResponse, RewardResponse


class RewardService:
    def __init__(self, db: AsyncSession, credit_service: CreditService | None = None) -> None:
        self.db = db
        self.credit_service = credit_service or CreditService(db)

    async def get_catalog(self) -> list[RewardResponse]:
        stmt = (
            select(Reward)
            .where(Reward.active.is_(True), Reward.deleted_at.is_(None))
            .order_by(Reward.title.asc())
        )
        result = await self.db.execute(stmt)
        return [self._to_reward_response(r) for r in result.scalars().all()]

    async def redeem(self, user_id: uuid.UUID, reward_id: uuid.UUID) -> RedemptionResponse:
        # NOTE: lookup by id only, with NO deleted_at filter — matches the
        # Java reference exactly (redeem() checks `active` but not
        # `deleted_at`, unlike the catalog query; a faithful port, not a fix).
        result = await self.db.execute(select(Reward).where(Reward.id == reward_id))
        reward = result.scalar_one_or_none()
        if reward is None:
            raise ResourceNotFoundException.of("Reward", reward_id)

        if not reward.active:
            raise BadRequestException("This reward is no longer available")

        if reward.stock is not None and reward.stock <= 0:
            raise BadRequestException("This reward is out of stock")

        success = await self.credit_service.debit_credits(
            user_id, reward.cost_credits, f"Redeemed: {reward.title}", "redemption", reward_id
        )
        if not success:
            raise BadRequestException(f"Insufficient credits. Need {reward.cost_credits}")

        if reward.stock is not None:
            reward.stock = reward.stock - 1
            await self.db.flush()

        redemption = Redemption(
            user_id=user_id,
            reward_id=reward_id,
            cost_credits=reward.cost_credits,
            status="PENDING",
        )
        self.db.add(redemption)
        await self.db.flush()
        await self.db.commit()
        return self._to_redemption_response(redemption, reward)

    async def get_redemptions(self, user_id: uuid.UUID) -> list[RedemptionResponse]:
        stmt = (
            select(Redemption)
            .where(Redemption.user_id == user_id)
            .order_by(Redemption.created_at.desc())
        )
        result = await self.db.execute(stmt)
        redemptions = result.scalars().all()

        responses = []
        for r in redemptions:
            reward_result = await self.db.execute(select(Reward).where(Reward.id == r.reward_id))
            reward = reward_result.scalar_one_or_none()
            responses.append(self._to_redemption_response(r, reward))
        return responses

    @staticmethod
    def _to_reward_response(r: Reward) -> RewardResponse:
        return RewardResponse(
            id=r.id,
            reward_key=r.reward_key,
            title=r.title,
            description=r.description,
            cost_credits=r.cost_credits,
            stock=r.stock,
            partner=r.partner,
            image_url=r.image_url,
        )

    @staticmethod
    def _to_redemption_response(r: Redemption, reward: Reward | None) -> RedemptionResponse:
        return RedemptionResponse(
            id=r.id,
            reward_id=r.reward_id,
            reward_title=reward.title if reward is not None else "Unknown",
            cost_credits=r.cost_credits,
            status=r.status,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
