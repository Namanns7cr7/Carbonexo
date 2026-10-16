"""Credit service — manages the append-only ledger. Exact port of
credit/CreditService.java: accrual hooks (called by other services on
carbon-saved, action-done, bill-upload, signup), balance query, and history.
"""
from __future__ import annotations

import uuid
from datetime import UTC

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.app_config.service import AppConfigService
from app.credit.models import CreditLedger
from app.credit.rule_engine import CreditRuleEngine
from app.credit.schemas import CreditBalanceResponse, CreditHistoryResponse


class CreditService:
    def __init__(
        self,
        db: AsyncSession,
        rule_engine: CreditRuleEngine | None = None,
        app_config: AppConfigService | None = None,
    ) -> None:
        self.db = db
        self.rule_engine = rule_engine or CreditRuleEngine(db)
        self.app_config = app_config or AppConfigService(db)

    async def _sum_delta_by_user_id(self, user_id: uuid.UUID) -> int:
        stmt = select(func.coalesce(func.sum(CreditLedger.delta), 0)).where(CreditLedger.user_id == user_id)
        result = await self.db.execute(stmt)
        return int(result.scalar_one())

    async def award_credits(
        self,
        user_id: uuid.UUID,
        credits: int,
        reason: str,
        rule_key: str | None,
        ref_type: str | None,
        ref_id: uuid.UUID | None,
    ) -> None:
        if not await self.app_config.get_bool("credits.enabled", True):
            return
        if credits <= 0:
            return

        current_balance = await self._sum_delta_by_user_id(user_id)
        entry = CreditLedger(
            user_id=user_id,
            delta=credits,
            balance_after=current_balance + credits,
            reason=reason,
            rule_key=rule_key,
            ref_type=ref_type,
            ref_id=ref_id,
            created_by=user_id,
        )
        self.db.add(entry)
        await self.db.flush()

    async def debit_credits(
        self,
        user_id: uuid.UUID,
        credits: int,
        reason: str,
        ref_type: str | None,
        ref_id: uuid.UUID | None,
    ) -> bool:
        current_balance = await self._sum_delta_by_user_id(user_id)
        if current_balance < credits:
            return False

        entry = CreditLedger(
            user_id=user_id,
            delta=-credits,
            balance_after=current_balance - credits,
            reason=reason,
            rule_key=None,
            ref_type=ref_type,
            ref_id=ref_id,
            created_by=user_id,
        )
        self.db.add(entry)
        await self.db.flush()
        return True

    async def get_balance(self, user_id: uuid.UUID) -> CreditBalanceResponse:
        balance = await self._sum_delta_by_user_id(user_id)
        return CreditBalanceResponse(user_id=user_id, balance=balance)

    async def get_history(self, user_id: uuid.UUID) -> list[CreditHistoryResponse]:
        stmt = select(CreditLedger).where(CreditLedger.user_id == user_id).order_by(CreditLedger.created_at.desc())
        result = await self.db.execute(stmt)
        entries = result.scalars().all()
        return [
            CreditHistoryResponse(
                id=e.id,
                delta=e.delta,
                balance_after=e.balance_after,
                reason=e.reason,
                rule_key=e.rule_key,
                ref_type=e.ref_type,
                created_at=_instant_str(e.created_at),
            )
            for e in entries
        ]

    # --- Accrual hooks (called by other services) ---

    async def on_signup(self, user_id: uuid.UUID) -> None:
        credits = await self.rule_engine.signup_bonus()
        await self.award_credits(user_id, credits, "Welcome bonus", "signup_bonus", "signup", user_id)

    async def on_carbon_saved(self, user_id: uuid.UUID, kg_saved: float) -> None:
        credits = await self.rule_engine.credits_for_kg_saved(kg_saved)
        await self.award_credits(
            user_id, credits, f"{kg_saved} kg CO₂ saved", "kg_saved", "carbon_saved", None
        )

    async def on_action_done(self, user_id: uuid.UUID, action_id: uuid.UUID) -> None:
        credits = await self.rule_engine.credits_for_action_done()
        await self.award_credits(user_id, credits, "Action completed", "action_done", "action", action_id)

    async def on_bill_upload(self, user_id: uuid.UUID, bill_id: uuid.UUID) -> None:
        credits = await self.rule_engine.credits_for_bill_upload()
        await self.award_credits(
            user_id, credits, "Bill uploaded & confirmed", "bill_upload", "bill", bill_id
        )


def _instant_str(dt) -> str:
    """Mirror Java's Instant#toString(): ISO-8601 UTC with a trailing 'Z'."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).isoformat().replace("+00:00", "Z")
