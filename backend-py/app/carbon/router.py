"""Dashboard + emission-factors endpoints — mirrors carbon/DashboardController.java
paths exactly: GET /api/dashboard, GET /api/emission-factors?region=GLOBAL.
"""
from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.carbon.calc_service import CarbonCalculationService
from app.carbon.dashboard_service import DashboardService
from app.carbon.schemas import DashboardResponse, EmissionFactorResponse
from app.common.security_deps import UserPrincipal, get_current_user
from app.db.session import get_db

router = APIRouter(prefix="/api", tags=["Dashboard"])


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    user: UserPrincipal = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> DashboardResponse:
    return await DashboardService(db).get_dashboard(user.user_id)


@router.get("/emission-factors", response_model=list[EmissionFactorResponse])
async def get_emission_factors(
    region: str = "GLOBAL",
    user: UserPrincipal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[EmissionFactorResponse]:
    factors = await CarbonCalculationService(db).get_active_factors(region)
    return [
        EmissionFactorResponse(
            id=f.id,
            category=f.category,
            factor_key=f.factor_key,
            label=f.label,
            emoji=f.emoji,
            unit=f.unit,
            factor_kg_per_unit=f.factor_kg_per_unit,
            default_qty=f.default_qty if f.default_qty is not None else Decimal("1.0"),
        )
        for f in factors
    ]
