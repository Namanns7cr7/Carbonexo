"""Mirrors credit/CreditRuleEngineTest.java 1:1, using the sqlite_session
fixture to stand in for the mocked CreditRuleRepository.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from app.credit.models import CreditRule
from app.credit.rule_engine import CreditRuleEngine


@pytest.mark.asyncio
async def test_multiplies_credits_per_unit_by_quantity(sqlite_session):
    sqlite_session.add(
        CreditRule(
            rule_key="kg_saved",
            rule_type="PER_KG_SAVED",
            credits_per_unit=Decimal(2),
            active=True,
            valid_from=date(2020, 1, 1),
        )
    )
    await sqlite_session.commit()

    engine = CreditRuleEngine(sqlite_session)
    assert await engine.credits_for_kg_saved(10.0) == 20  # 2 * 10


@pytest.mark.asyncio
async def test_returns_zero_when_no_active_rule(sqlite_session):
    engine = CreditRuleEngine(sqlite_session)
    assert await engine.credits_for_bill_upload() == 0
    assert await engine.credits_for_action_done() == 0
