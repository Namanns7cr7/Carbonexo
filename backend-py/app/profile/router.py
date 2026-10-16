"""Profile endpoints (authenticated) — mirrors profile/UserProfileController.java
paths and status codes exactly: GET/PUT /api/profiles/me, POST /api/profiles/me/onboarding.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.security_deps import UserPrincipal, get_current_user
from app.db.session import get_db
from app.profile.schemas import ProfileRequest, ProfileResponse
from app.profile.service import UserProfileService

router = APIRouter(prefix="/api/profiles", tags=["Profile"])


@router.get("/me", response_model=ProfileResponse)
async def get_me(
    user: UserPrincipal = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> ProfileResponse:
    return await UserProfileService(db).get_by_user_id(user.user_id)


@router.put("/me", response_model=ProfileResponse)
async def update_me(
    req: ProfileRequest,
    user: UserPrincipal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfileResponse:
    return await UserProfileService(db).create_or_update(user.user_id, req)


@router.post("/me/onboarding", response_model=ProfileResponse)
async def complete_onboarding(
    user: UserPrincipal = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> ProfileResponse:
    return await UserProfileService(db).complete_onboarding(user.user_id)
