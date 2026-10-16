"""Mirrors carbon/DashboardServiceTest.java 1:1 (today/yesterday totals, delta
percentage, and streak computation — the three load-bearing behaviors the
Java test suite exercises).
"""
from __future__ import annotations

import uuid
from datetime import timedelta
from decimal import Decimal

import pytest

from app.carbon.dashboard_service import DashboardService, _today
from app.carbon.models import ActivityLog


async def _log(session, user_id: uuid.UUID, d, co2: str) -> None:
    session.add(
        ActivityLog(
            user_id=user_id,
            category="travel",
            label="x",
            co2_kg=Decimal(co2),
            activity_date=d,
            source="manual",
        )
    )
    await session.commit()


@pytest.mark.asyncio
async def test_get_dashboard_computes_correct_totals_and_delta(sqlite_session):
    user = uuid.uuid4()
    today = _today()
    yesterday = today - timedelta(days=1)
    await _log(sqlite_session, user, today, "10.00")
    await _log(sqlite_session, user, yesterday, "8.00")

    svc = DashboardService(sqlite_session)
    dash = await svc.get_dashboard(user)

    assert dash.today_total == 10.0
    assert dash.yesterday_total == 8.0
    assert dash.delta_pct == 25  # ((10-8)/8)*100


@pytest.mark.asyncio
async def test_get_dashboard_computes_negative_delta_correctly(sqlite_session):
    user = uuid.uuid4()
    today = _today()
    yesterday = today - timedelta(days=1)
    await _log(sqlite_session, user, today, "6.00")
    await _log(sqlite_session, user, yesterday, "8.00")

    svc = DashboardService(sqlite_session)
    dash = await svc.get_dashboard(user)

    assert dash.today_total == 6.0
    assert dash.yesterday_total == 8.0
    assert dash.delta_pct == -25


@pytest.mark.asyncio
async def test_compute_streak_correctly_counts_consecutive_days(sqlite_session):
    user = uuid.uuid4()
    today = _today()
    day_before = today - timedelta(days=2)
    gap_day = today - timedelta(days=4)  # today-3 is deliberately missing

    await _log(sqlite_session, user, today, "1.0")
    await _log(sqlite_session, user, today - timedelta(days=1), "1.0")
    await _log(sqlite_session, user, day_before, "1.0")
    await _log(sqlite_session, user, gap_day, "1.0")

    svc = DashboardService(sqlite_session)
    streak = await svc._compute_streak(user)
    assert streak == 3
