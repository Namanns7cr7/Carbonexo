"""Config-driven credit rule engine — exact port of credit/CreditRuleEngine.java.
Reads rules from the `credit_rules` table. No hardcoded reward values.
"""
from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.credit.models import CreditRule

log = logging.getLogger(__name__)


class CreditRuleEngine:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _find_active_by_key(self, rule_key: str) -> CreditRule | None:
        today = date.today()
        stmt = select(CreditRule).where(
            CreditRule.rule_key == rule_key,
            CreditRule.active.is_(True),
            CreditRule.valid_from <= today,
            or_(CreditRule.valid_to.is_(None), CreditRule.valid_to >= today),
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _calculate(self, rule_key: str, quantity: float) -> int:
        rule = await self._find_active_by_key(rule_key)
        if rule is None:
            log.warning("No active credit rule for key=%s", rule_key)
            return 0
        credits = rule.credits_per_unit * Decimal(str(quantity))
        # Truncate toward zero, matching BigDecimal#intValue() (NOT rounding).
        return int(credits)

    async def credits_for_kg_saved(self, kg_saved: float) -> int:
        return await self._calculate("kg_saved", kg_saved)

    async def credits_for_action_done(self) -> int:
        return await self._calculate("action_done", 1.0)

    async def credits_for_streak_day(self) -> int:
        return await self._calculate("streak_day", 1.0)

    async def signup_bonus(self) -> int:
        return await self._calculate("signup_bonus", 1.0)

    async def credits_for_bill_upload(self) -> int:
        return await self._calculate("bill_upload", 1.0)
