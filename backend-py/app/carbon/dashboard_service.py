"""DashboardService — exact port of carbon/DashboardService.java.

Timezone note: the Java reference calls `LocalDate.now()` with no explicit
zone (JVM default) — a genuine ambiguity in the reference, not something we
can read off the source. This port pins it to UTC explicitly (deterministic
across deploy environments) rather than guessing at a JVM default; revisit if
the product wants a user-local timezone instead.
"""
from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.carbon.calc_service import CarbonCalculationService, scale_decimal
from app.carbon.models import ActivityLog
from app.carbon.schemas import ActivityLogResponse, DashboardResponse, DayTotal
from app.profile.models import UserProfile

_BASELINE_DAILY_KG = Decimal("8.0")  # fallback ~ average person, matches Java's hardcoded constant


def _today() -> date:
    return datetime.now(UTC).date()


class DashboardService:
    def __init__(self, db: AsyncSession, carbon_service: CarbonCalculationService | None = None) -> None:
        self.db = db
        self.carbon_service = carbon_service or CarbonCalculationService(db)

    async def _sum_co2_on_date(self, user_id: uuid.UUID, d: date) -> Decimal:
        stmt = select(func.coalesce(func.sum(ActivityLog.co2_kg), 0)).where(
            ActivityLog.user_id == user_id,
            ActivityLog.activity_date == d,
            ActivityLog.deleted_at.is_(None),
        )
        result = await self.db.execute(stmt)
        return Decimal(result.scalar_one())

    async def _breakdown_by_category(self, user_id: uuid.UUID, from_date: date, to_date: date) -> dict[str, float]:
        stmt = (
            select(ActivityLog.category, func.coalesce(func.sum(ActivityLog.co2_kg), 0))
            .where(
                ActivityLog.user_id == user_id,
                ActivityLog.activity_date >= from_date,
                ActivityLog.activity_date <= to_date,
                ActivityLog.deleted_at.is_(None),
            )
            .group_by(ActivityLog.category)
        )
        result = await self.db.execute(stmt)
        return {category: float(total) for category, total in result.all()}

    async def _distinct_dates(self, user_id: uuid.UUID) -> set[date]:
        stmt = (
            select(ActivityLog.activity_date)
            .where(ActivityLog.user_id == user_id, ActivityLog.deleted_at.is_(None))
            .distinct()
        )
        result = await self.db.execute(stmt)
        return set(result.scalars().all())

    async def _compute_streak(self, user_id: uuid.UUID) -> int:
        dates = await self._distinct_dates(user_id)
        if not dates:
            return 0
        streak = 0
        check = _today()
        while check in dates:
            streak += 1
            check = check - timedelta(days=1)
        return streak

    async def _today_logs(self, user_id: uuid.UUID, today: date) -> list[ActivityLogResponse]:
        stmt = select(ActivityLog).where(
            ActivityLog.user_id == user_id,
            ActivityLog.activity_date == today,
            ActivityLog.deleted_at.is_(None),
        )
        result = await self.db.execute(stmt)
        return [_to_activity_response(a) for a in result.scalars().all()]

    async def get_dashboard(self, user_id: uuid.UUID) -> DashboardResponse:
        today = _today()
        yesterday = today - timedelta(days=1)
        week_start = today - timedelta(days=6)

        today_total = await self._sum_co2_on_date(user_id, today)
        yesterday_total = await self._sum_co2_on_date(user_id, yesterday)

        delta_pct = 0
        if yesterday_total > 0:
            ratio = (today_total - yesterday_total) / yesterday_total
            ratio = ratio.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            delta_pct = int(ratio * 100)  # truncates toward zero, matching BigDecimal#intValue()

        week_totals: list[DayTotal] = []
        for i in range(6, -1, -1):
            d = today - timedelta(days=i)
            total = await self._sum_co2_on_date(user_id, d)
            week_totals.append(DayTotal(date=d.isoformat(), total=float(scale_decimal(total, 1))))

        today_breakdown = await self._breakdown_by_category(user_id, today, today)
        week_breakdown = await self._breakdown_by_category(user_id, week_start, today)

        biggest_category: str | None = None
        biggest_value = 0.0
        for category, value in week_breakdown.items():
            if value > biggest_value:
                biggest_category = category
                biggest_value = value

        streak = await self._compute_streak(user_id)

        profile_stmt = select(UserProfile).where(
            UserProfile.user_id == user_id, UserProfile.deleted_at.is_(None)
        )
        profile_result = await self.db.execute(profile_stmt)
        profile = profile_result.scalar_one_or_none()
        total_saved = 0.0
        if profile is not None:
            month_start = today.replace(day=1)
            saved = await self.carbon_service.carbon_saved(user_id, month_start, today, _BASELINE_DAILY_KG)
            total_saved = float(saved)

        today_logs = await self._today_logs(user_id, today)

        return DashboardResponse(
            today_total=float(scale_decimal(today_total, 1)),
            yesterday_total=float(scale_decimal(yesterday_total, 1)),
            delta_pct=delta_pct,
            today_breakdown=today_breakdown,
            week_breakdown=week_breakdown,
            week_totals=week_totals,
            biggest_category=biggest_category,
            biggest_value=biggest_value,
            streak=streak,
            total_saved=total_saved,
            today_logs=today_logs,
        )


def _to_activity_response(a: ActivityLog) -> ActivityLogResponse:
    return ActivityLogResponse(
        id=a.id,
        category=a.category,
        factor_key=a.factor_key,
        label=a.label,
        emoji=a.emoji,
        quantity=a.quantity,
        unit=a.unit,
        co2_kg=a.co2_kg,
        note=a.note,
        activity_date=a.activity_date.isoformat(),
        source=a.source,
    )
