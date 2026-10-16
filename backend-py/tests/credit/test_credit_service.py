"""Mirrors credit/CreditServiceTest.java 1:1, using the sqlite_session fixture
to stand in for the mocked CreditLedgerRepository, and a fake AppConfigService
stub (matching the mocked AppConfigService in Java) to control the
`credits.enabled` flag directly without touching the DB.
"""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from app.credit.models import CreditLedger
from app.credit.service import CreditService


class _FakeAppConfig:
    def __init__(self, enabled: bool) -> None:
        self._enabled = enabled

    async def get_bool(self, key: str, default: bool) -> bool:
        return self._enabled


def make_service(session, enabled: bool = True) -> CreditService:
    return CreditService(session, app_config=_FakeAppConfig(enabled))


async def _seed_balance(session, user_id: uuid.UUID, balance: int) -> None:
    if balance == 0:
        return
    session.add(
        CreditLedger(user_id=user_id, delta=balance, balance_after=balance, reason="seed", created_by=user_id)
    )
    await session.commit()


@pytest.mark.asyncio
async def test_awards_credits_with_running_balance(sqlite_session):
    user = uuid.uuid4()
    await _seed_balance(sqlite_session, user, 100)
    svc = make_service(sqlite_session, enabled=True)

    await svc.award_credits(user, 50, "reason", "rule", "type", None)

    result = await sqlite_session.execute(
        select(CreditLedger).where(CreditLedger.user_id == user, CreditLedger.reason == "reason")
    )
    entry = result.scalar_one()
    assert entry.delta == 50
    assert entry.balance_after == 150  # 100 + 50


@pytest.mark.asyncio
async def test_does_not_award_when_credits_disabled(sqlite_session):
    user = uuid.uuid4()
    svc = make_service(sqlite_session, enabled=False)

    await svc.award_credits(user, 50, "r", "k", "t", None)

    result = await sqlite_session.execute(select(CreditLedger).where(CreditLedger.user_id == user))
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_does_not_award_non_positive_credits(sqlite_session):
    user = uuid.uuid4()
    svc = make_service(sqlite_session, enabled=True)

    await svc.award_credits(user, 0, "r", "k", "t", None)

    result = await sqlite_session.execute(select(CreditLedger).where(CreditLedger.user_id == user))
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_debit_fails_on_insufficient_balance(sqlite_session):
    user = uuid.uuid4()
    await _seed_balance(sqlite_session, user, 10)
    svc = make_service(sqlite_session)

    success = await svc.debit_credits(user, 50, "r", "t", None)
    assert success is False

    result = await sqlite_session.execute(
        select(CreditLedger).where(CreditLedger.user_id == user, CreditLedger.delta < 0)
    )
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_debit_succeeds_and_records_negative_delta(sqlite_session):
    user = uuid.uuid4()
    await _seed_balance(sqlite_session, user, 100)
    svc = make_service(sqlite_session)

    success = await svc.debit_credits(user, 30, "r", "t", None)
    assert success is True

    result = await sqlite_session.execute(
        select(CreditLedger).where(CreditLedger.user_id == user, CreditLedger.delta < 0)
    )
    entry = result.scalar_one()
    assert entry.delta == -30
    assert entry.balance_after == 70  # 100 - 30
