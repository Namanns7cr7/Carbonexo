"""UserProfileService — exact port of profile/UserProfileService.java.

GET /me never 404s for an authenticated user: it auto-creates a default
profile (name copied from the User's display_name, onboarded=False) on first
call, and that row IS persisted even though it's triggered by a read.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.profile.models import UserProfile
from app.profile.schemas import ProfileRequest, ProfileResponse


class UserProfileService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _find_by_user_id(self, user_id: uuid.UUID) -> UserProfile | None:
        stmt = select(UserProfile).where(UserProfile.user_id == user_id, UserProfile.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _display_name_for(self, user_id: uuid.UUID) -> str | None:
        stmt = select(User).where(User.id == user_id, User.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        return user.display_name if user is not None else None

    async def get_by_user_id(self, user_id: uuid.UUID) -> ProfileResponse:
        profile = await self._find_by_user_id(user_id)
        if profile is None:
            profile = UserProfile(user_id=user_id, name=await self._display_name_for(user_id), onboarded=False)
            self.db.add(profile)
            await self.db.flush()
            await self.db.commit()
        return self._to_response(profile)

    async def create_or_update(self, user_id: uuid.UUID, req: ProfileRequest) -> ProfileResponse:
        profile = await self._find_by_user_id(user_id)
        if profile is None:
            profile = UserProfile(user_id=user_id)
            self.db.add(profile)

        if req.name is not None:
            profile.name = req.name
        if req.travel_mode is not None:
            profile.travel_mode = req.travel_mode
        if req.daily_distance_km is not None:
            profile.daily_distance_km = req.daily_distance_km
        if req.diet is not None:
            profile.diet = req.diet
        if req.electricity_usage is not None:
            profile.electricity_usage = req.electricity_usage
        if req.shopping_habit is not None:
            profile.shopping_habit = req.shopping_habit
        if req.weekly_goal_pct is not None:
            profile.weekly_goal_pct = req.weekly_goal_pct
        # Only touch onboarded when explicitly provided, so a plain profile
        # edit does not reset the onboarding flag.
        if req.onboarded is not None:
            profile.onboarded = req.onboarded

        await self.db.flush()
        await self.db.commit()
        return self._to_response(profile)

    async def complete_onboarding(self, user_id: uuid.UUID) -> ProfileResponse:
        profile = await self._find_by_user_id(user_id)
        if profile is None:
            profile = UserProfile(user_id=user_id, name=await self._display_name_for(user_id))
            self.db.add(profile)
        profile.onboarded = True
        await self.db.flush()
        await self.db.commit()
        return self._to_response(profile)

    @staticmethod
    def _to_response(p: UserProfile) -> ProfileResponse:
        return ProfileResponse(
            id=p.id,
            user_id=p.user_id,
            name=p.name,
            travel_mode=p.travel_mode,
            daily_distance_km=p.daily_distance_km,
            diet=p.diet,
            electricity_usage=p.electricity_usage,
            shopping_habit=p.shopping_habit,
            weekly_goal_pct=p.weekly_goal_pct,
            region=p.region,
            onboarded=p.onboarded,
        )
