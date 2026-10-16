"""Mirrors carbon/CarbonCalculationServiceTest.java 1:1."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from app.carbon.calc_service import CarbonCalculationService
from app.carbon.models import EmissionFactor


class _FakeAppConfig:
    async def get_double(self, key: str, default: float) -> float:
        return 0.45


@pytest.mark.asyncio
async def test_uses_the_database_factor_when_present(sqlite_session):
    sqlite_session.add(
        EmissionFactor(
            category="travel",
            factor_key="car_ride",
            label="Car ride",
            unit="km",
            factor_kg_per_unit=Decimal("0.18"),
            region="GLOBAL",
            effective_from=date(2020, 1, 1),
            active=True,
        )
    )
    await sqlite_session.commit()

    svc = CarbonCalculationService(sqlite_session, app_config=_FakeAppConfig())
    result = await svc.calculate_co2("car_ride", Decimal(10), "GLOBAL")
    assert result == Decimal("1.800")


@pytest.mark.asyncio
async def test_falls_back_to_config_default_for_electricity(sqlite_session):
    svc = CarbonCalculationService(sqlite_session, app_config=_FakeAppConfig())
    result = await svc.calculate_co2("home_electricity", Decimal(4), "GLOBAL")
    assert result == Decimal("1.800")  # 0.45 * 4


@pytest.mark.asyncio
async def test_returns_zero_when_no_factor_and_not_electricity(sqlite_session):
    svc = CarbonCalculationService(sqlite_session, app_config=_FakeAppConfig())
    result = await svc.calculate_co2("unknown_key", Decimal(10), "GLOBAL")
    assert result == Decimal(0)
