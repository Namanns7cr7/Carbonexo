"""Mirrors reward/RewardServiceTest.java 1:1, using a fake CreditService stub
(matching the mocked CreditService in Java) to control debit_credits'
success/failure without touching the ledger.
"""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from app.common.errors import BadRequestException, ResourceNotFoundException
from app.reward.models import Redemption, Reward
from app.reward.service import RewardService


class _FakeCreditService:
    def __init__(self, succeeds: bool) -> None:
        self.succeeds = succeeds
        self.calls: list[tuple] = []

    async def debit_credits(self, user_id, credits, reason, ref_type, ref_id) -> bool:
        self.calls.append((user_id, credits, reason, ref_type, ref_id))
        return self.succeeds


async def _make_reward(session, *, cost=100, stock=5, active=True, title="Eco Tote") -> Reward:
    reward = Reward(reward_key=f"key-{uuid.uuid4()}", title=title, cost_credits=cost, stock=stock, active=active)
    session.add(reward)
    await session.commit()
    await session.refresh(reward)
    return reward


@pytest.mark.asyncio
async def test_redeem_throws_when_reward_missing(sqlite_session):
    credits = _FakeCreditService(succeeds=True)
    svc = RewardService(sqlite_session, credit_service=credits)

    with pytest.raises(ResourceNotFoundException):
        await svc.redeem(uuid.uuid4(), uuid.uuid4())


@pytest.mark.asyncio
async def test_redeem_throws_when_out_of_stock(sqlite_session):
    reward = await _make_reward(sqlite_session, cost=100, stock=0, active=True)
    credits = _FakeCreditService(succeeds=True)
    svc = RewardService(sqlite_session, credit_service=credits)

    with pytest.raises(BadRequestException):
        await svc.redeem(uuid.uuid4(), reward.id)

    assert credits.calls == []  # debit must never be attempted when out of stock


@pytest.mark.asyncio
async def test_redeem_throws_when_insufficient_credits(sqlite_session):
    reward = await _make_reward(sqlite_session, cost=500, stock=5, active=True)
    credits = _FakeCreditService(succeeds=False)
    svc = RewardService(sqlite_session, credit_service=credits)
    user_id = uuid.uuid4()

    with pytest.raises(BadRequestException):
        await svc.redeem(user_id, reward.id)

    result = await sqlite_session.execute(select(Redemption).where(Redemption.user_id == user_id))
    assert result.scalar_one_or_none() is None  # no redemption row created when debit fails


@pytest.mark.asyncio
async def test_redeem_succeeds_debits_and_records_redemption(sqlite_session):
    reward = await _make_reward(sqlite_session, cost=100, stock=5, active=True)
    credits = _FakeCreditService(succeeds=True)
    svc = RewardService(sqlite_session, credit_service=credits)
    user_id = uuid.uuid4()

    resp = await svc.redeem(user_id, reward.id)

    assert resp is not None
    assert credits.calls == [(user_id, 100, credits.calls[0][2], "redemption", reward.id)]

    result = await sqlite_session.execute(select(Redemption).where(Redemption.user_id == user_id))
    assert result.scalar_one_or_none() is not None
