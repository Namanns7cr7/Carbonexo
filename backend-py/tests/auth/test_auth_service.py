"""Mirrors auth/AuthServiceTest.java: register/login/refresh-rotation/logout.

Uses an in-memory SQLite DB (via the sqlite_session fixture) since this logic
is plain CRUD with no Postgres-specific features — no Postgres install
required to run these.
"""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.auth.jwt_service import JwtService
from app.auth.models import RefreshToken, User
from app.auth.schemas import LoginRequest, RegisterRequest
from app.auth.security import hash_password
from app.auth.service import AuthService
from app.common.errors import ConflictException, UnauthorizedException

JWT = JwtService(secret="0" * 40, access_ttl_seconds=900, issuer="ecotrack")


def make_service(session) -> AuthService:
    return AuthService(session, jwt_svc=JWT)


@pytest.mark.asyncio
async def test_register_throws_conflict_when_email_exists(sqlite_session):
    svc = make_service(sqlite_session)
    sqlite_session.add(User(
        email="test@example.com", password_hash=hash_password("whatever"),
        role="USER", status="ACTIVE", email_verified=False,
    ))
    await sqlite_session.commit()

    req = RegisterRequest(email="test@example.com", password="password123")
    with pytest.raises(ConflictException):
        await svc.register(req, None)


@pytest.mark.asyncio
async def test_register_saves_user_and_awards_credits(sqlite_session):
    svc = make_service(sqlite_session)
    req = RegisterRequest(email="new@example.com", password="password123", display_name="New User")

    with patch("app.auth.service._on_signup", new=AsyncMock()) as on_signup:
        resp = await svc.register(req, None)

    assert resp is not None
    assert resp.user.email == "new@example.com"
    on_signup.assert_awaited_once()

    result = await sqlite_session.execute(select(User).where(User.email == "new@example.com"))
    assert result.scalar_one_or_none() is not None

    rt_result = await sqlite_session.execute(select(RefreshToken))
    assert rt_result.scalars().first() is not None


@pytest.mark.asyncio
async def test_login_throws_unauthorized_on_user_not_found(sqlite_session):
    svc = make_service(sqlite_session)
    req = LoginRequest(email="missing@example.com", password="password123")
    with pytest.raises(UnauthorizedException):
        await svc.login(req, None)


@pytest.mark.asyncio
async def test_login_throws_unauthorized_on_password_mismatch(sqlite_session):
    svc = make_service(sqlite_session)
    sqlite_session.add(User(
        email="user@example.com", password_hash=hash_password("correct-password"),
        role="USER", status="ACTIVE", email_verified=False,
    ))
    await sqlite_session.commit()

    req = LoginRequest(email="user@example.com", password="wrong_pass")
    with pytest.raises(UnauthorizedException):
        await svc.login(req, None)


@pytest.mark.asyncio
async def test_login_succeeds_with_valid_credentials(sqlite_session):
    svc = make_service(sqlite_session)
    sqlite_session.add(User(
        email="user@example.com", password_hash=hash_password("correct-password"),
        role="USER", status="ACTIVE", email_verified=False,
    ))
    await sqlite_session.commit()

    req = LoginRequest(email="user@example.com", password="correct-password")
    resp = await svc.login(req, None)

    assert resp is not None
    assert resp.user.email == "user@example.com"
    assert resp.access_token
    assert resp.refresh_token


@pytest.mark.asyncio
async def test_refresh_rotates_token_revoking_old_and_issuing_new(sqlite_session):
    svc = make_service(sqlite_session)
    req = RegisterRequest(email="rotate@example.com", password="password123")
    with patch("app.auth.service._on_signup", new=AsyncMock()):
        first = await svc.register(req, None)

    old_raw_refresh = first.refresh_token

    second = await svc.refresh(old_raw_refresh, None)
    assert second.refresh_token != old_raw_refresh

    # old token revoked
    with pytest.raises(UnauthorizedException):
        await svc.refresh(old_raw_refresh, None)

    # new token still works to get another rotation
    third = await svc.refresh(second.refresh_token, None)
    assert third.refresh_token != second.refresh_token


@pytest.mark.asyncio
async def test_refresh_rejects_unknown_token(sqlite_session):
    svc = make_service(sqlite_session)
    with pytest.raises(UnauthorizedException):
        await svc.refresh(f"{uuid.uuid4()}.{uuid.uuid4()}", None)


@pytest.mark.asyncio
async def test_logout_revokes_token(sqlite_session):
    svc = make_service(sqlite_session)
    req = RegisterRequest(email="logout@example.com", password="password123")
    with patch("app.auth.service._on_signup", new=AsyncMock()):
        resp = await svc.register(req, None)

    await svc.logout(resp.refresh_token)

    with pytest.raises(UnauthorizedException):
        await svc.refresh(resp.refresh_token, None)


@pytest.mark.asyncio
async def test_logout_on_unknown_token_is_a_no_op(sqlite_session):
    svc = make_service(sqlite_session)
    # Should not raise even though the token doesn't exist.
    await svc.logout(f"{uuid.uuid4()}.{uuid.uuid4()}")
