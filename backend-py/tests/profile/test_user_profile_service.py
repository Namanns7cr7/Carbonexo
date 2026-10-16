"""Mirrors profile/UserProfileServiceTest.java 1:1."""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from app.auth.models import User
from app.auth.security import hash_password
from app.profile.models import UserProfile
from app.profile.schemas import ProfileRequest
from app.profile.service import UserProfileService


@pytest.mark.asyncio
async def test_get_by_user_id_auto_creates_default_profile_when_missing(sqlite_session):
    user = User(
        email="yash@example.com", password_hash=hash_password("x"), display_name="Yash",
        role="USER", status="ACTIVE", email_verified=False,
    )
    sqlite_session.add(user)
    await sqlite_session.commit()

    svc = UserProfileService(sqlite_session)
    resp = await svc.get_by_user_id(user.id)

    assert resp.name == "Yash"
    assert resp.onboarded is False

    result = await sqlite_session.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    assert result.scalar_one_or_none() is not None  # auto-create persists


@pytest.mark.asyncio
async def test_get_by_user_id_returns_existing_profile_without_saving(sqlite_session):
    user_id = uuid.uuid4()
    sqlite_session.add(UserProfile(user_id=user_id, name="Existing", onboarded=True))
    await sqlite_session.commit()

    svc = UserProfileService(sqlite_session)
    resp = await svc.get_by_user_id(user_id)

    assert resp.name == "Existing"
    assert resp.onboarded is True

    result = await sqlite_session.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    assert len(result.scalars().all()) == 1  # no duplicate profile created


@pytest.mark.asyncio
async def test_create_or_update_applies_only_non_null_fields(sqlite_session):
    user_id = uuid.uuid4()
    sqlite_session.add(UserProfile(user_id=user_id, name="Old", diet="vegan", onboarded=True))
    await sqlite_session.commit()

    svc = UserProfileService(sqlite_session)
    req = ProfileRequest(name="New")
    resp = await svc.create_or_update(user_id, req)

    assert resp.name == "New"
    assert resp.diet == "vegan"  # untouched
    assert resp.onboarded is True  # plain edit must not reset onboarding flag


@pytest.mark.asyncio
async def test_complete_onboarding_sets_flag_true(sqlite_session):
    user_id = uuid.uuid4()
    sqlite_session.add(UserProfile(user_id=user_id, onboarded=False))
    await sqlite_session.commit()

    svc = UserProfileService(sqlite_session)
    resp = await svc.complete_onboarding(user_id)

    assert resp.onboarded is True
