"""Carbon calculation — exact port of carbon/CarbonCalculationService.java.

`compute_co2` is pulled out as a standalone pure function (quantity * factor,
scaled 3dp HALF_UP) specifically so the `simulation/` package (a later phase)
can reuse the exact same arithmetic as real activity logging, without the two
ever drifting apart.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.app_config.service import AppConfigService
from app.carbon.models import ActivityLog, EmissionFactor
from app.config import settings

log = logging.getLogger(__name__)


def scale_decimal(value: Decimal, places: int) -> Decimal:
    quant = Decimal(1).scaleb(-places)
    return value.quantize(quant, rounding=ROUND_HALF_UP)


def compute_co2(factor_kg_per_unit: Decimal, quantity: Decimal) -> Decimal:
    """Pure function: co2 = quantity * factor, scaled to 3dp HALF_UP."""
    return scale_decimal(quantity * factor_kg_per_unit, 3)


class CarbonCalculationService:
    def __init__(self, db: AsyncSession, app_config: AppConfigService | None = None) -> None:
        self.db = db
        self.app_config = app_config or AppConfigService(db)

    async def _find_active_by_key_and_region(self, factor_key: str, region: str) -> EmissionFactor | None:
        today = date.today()
        stmt = select(EmissionFactor).where(
            EmissionFactor.factor_key == factor_key,
            EmissionFactor.region == region,
            EmissionFactor.active.is_(True),
            EmissionFactor.effective_from <= today,
            or_(EmissionFactor.effective_to.is_(None), EmissionFactor.effective_to >= today),
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def calculate_co2(self, factor_key: str | None, quantity: Decimal, region: str) -> Decimal:
        factor = await self._find_active_by_key_and_region(factor_key, region) if factor_key else None
        if factor is not None:
            return compute_co2(factor.factor_kg_per_unit, quantity)

        if factor_key is not None and "electricity" in factor_key:
            fallback = await self.app_config.get_double(
                "carbon.electricity_factor_default", settings.CARBON_ELECTRICITY_FACTOR
            )
            return compute_co2(Decimal(str(fallback)), quantity)

        log.warning("No emission factor found for key=%s, region=%s", factor_key, region)
        return Decimal(0)

    async def electricity_carbon(self, kwh: Decimal, region: str) -> Decimal:
        return await self.calculate_co2("home_electricity", kwh, region)

    async def transport_carbon(self, mode_factor_key: str, km: Decimal, region: str) -> Decimal:
        return await self.calculate_co2(mode_factor_key, km, region)

    async def _sum_co2_in_range(self, user_id: uuid.UUID, from_date: date, to_date: date) -> Decimal:
        stmt = select(func.coalesce(func.sum(ActivityLog.co2_kg), 0)).where(
            ActivityLog.user_id == user_id,
            ActivityLog.activity_date >= from_date,
            ActivityLog.activity_date <= to_date,
            ActivityLog.deleted_at.is_(None),
        )
        result = await self.db.execute(stmt)
        return Decimal(result.scalar_one())

    async def monthly_co2(self, user_id: uuid.UUID, year: int, month: int) -> Decimal:
        first = date(year, month, 1)
        last_day = (date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1))
        from datetime import timedelta

        last = last_day - timedelta(days=1)
        total = await self._sum_co2_in_range(user_id, first, last)
        return scale_decimal(total, 1)

    async def yearly_co2(self, user_id: uuid.UUID, year: int) -> Decimal:
        total = await self._sum_co2_in_range(user_id, date(year, 1, 1), date(year, 12, 31))
        return scale_decimal(total, 1)

    async def carbon_saved(
        self, user_id: uuid.UUID, from_date: date, to_date: date, baseline_daily_kg: Decimal
    ) -> Decimal:
        days = (to_date - from_date).days + 1  # inclusive
        baseline_total = baseline_daily_kg * days
        actual = await self._sum_co2_in_range(user_id, from_date, to_date)
        saved = baseline_total - actual
        return scale_decimal(max(saved, Decimal(0)), 1)

    async def get_active_factors(self, region: str) -> list[EmissionFactor]:
        today = date.today()
        stmt = (
            select(EmissionFactor)
            .where(
                EmissionFactor.active.is_(True),
                EmissionFactor.region == region,
                EmissionFactor.effective_from <= today,
                or_(EmissionFactor.effective_to.is_(None), EmissionFactor.effective_to >= today),
            )
            .order_by(EmissionFactor.category, EmissionFactor.label)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_all_active_factors(self) -> list[EmissionFactor]:
        today = date.today()
        stmt = (
            select(EmissionFactor)
            .where(
                EmissionFactor.active.is_(True),
                EmissionFactor.effective_from <= today,
                or_(EmissionFactor.effective_to.is_(None), EmissionFactor.effective_to >= today),
            )
            .order_by(EmissionFactor.category, EmissionFactor.label)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
