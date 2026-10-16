"""Registration, login, Google login, refresh-token rotation and logout.
Mirrors auth/AuthService.java. Access tokens are JWTs; refresh tokens are
opaque random strings stored only as SHA-256 hashes and rotated on every use.
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.google_verifier import GoogleTokenVerifier
from app.auth.google_verifier import google_verifier as default_google_verifier
from app.auth.jwt_service import JwtService
from app.auth.jwt_service import jwt_service as default_jwt_service
from app.auth.models import RefreshToken, User
from app.auth.schemas import AuthResponse, LoginRequest, RegisterRequest, UserSummary
from app.auth.security import hash_password, verify_password
from app.common.errors import BadRequestException, ConflictException, UnauthorizedException
from app.config import settings
from app.credit.service import CreditService


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _truncate(value: str | None, max_len: int) -> str | None:
    if value is None:
        return None
    return value if len(value) <= max_len else value[:max_len]


async def _on_signup(user_id: uuid.UUID, db: AsyncSession) -> None:
    """Hook for the signup-bonus credit award — mirrors CreditService.onSignup
    in Java, called from AuthService.register/login_with_google on new-user
    creation.
    """
    await CreditService(db).on_signup(user_id)


class AuthService:
    def __init__(
        self,
        db: AsyncSession,
        jwt_svc: JwtService | None = None,
        google_verifier: GoogleTokenVerifier | None = None,
    ) -> None:
        self.db = db
        self.jwt_service = jwt_svc or default_jwt_service
        self.google_verifier = google_verifier or default_google_verifier
        self.refresh_ttl_seconds = settings.JWT_REFRESH_TTL

    async def _find_user_by_email(self, email: str) -> User | None:
        stmt = select(User).where(
            User.email.ilike(email), User.deleted_at.is_(None)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _find_user_by_id(self, user_id: uuid.UUID) -> User | None:
        stmt = select(User).where(User.id == user_id, User.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def register(self, req: RegisterRequest, http: Request | None = None) -> AuthResponse:
        existing = await self._find_user_by_email(req.email)
        if existing is not None:
            raise ConflictException("Email already registered")

        user = User(
            email=req.email.strip(),
            password_hash=hash_password(req.password),
            display_name=req.display_name,
            role="USER",
            status="ACTIVE",
            email_verified=False,
        )
        self.db.add(user)
        await self.db.flush()
        await _on_signup(user.id, self.db)
        response = await self._issue_tokens(user, http)
        await self.db.commit()
        return response

    async def login(self, req: LoginRequest, http: Request | None = None) -> AuthResponse:
        user = await self._find_user_by_email(req.email)
        if user is None:
            raise UnauthorizedException("Invalid email or password")
        if not verify_password(req.password, user.password_hash):
            raise UnauthorizedException("Invalid email or password")
        user.last_login_at = datetime.now(UTC)
        response = await self._issue_tokens(user, http)
        await self.db.commit()
        return response

    async def login_with_google(self, id_token: str, http: Request | None = None) -> AuthResponse:
        if not self.google_verifier.is_configured():
            raise BadRequestException("Google login is not enabled on this server")
        payload = self.google_verifier.verify(id_token)
        if payload is None:
            raise UnauthorizedException("Invalid Google ID token")

        email = payload.get("email")
        email_verified = payload.get("email_verified")
        if not email or email_verified is False:
            raise UnauthorizedException("Google account has no verified email")
        name = payload.get("name")

        user = await self._find_user_by_email(email)
        if user is None:
            user = User(
                email=email.strip(),
                password_hash=hash_password(str(uuid.uuid4())),
                display_name=name or email,
                role="USER",
                status="ACTIVE",
                email_verified=True,
            )
            self.db.add(user)
            await self.db.flush()
            await _on_signup(user.id, self.db)

        user.last_login_at = datetime.now(UTC)
        response = await self._issue_tokens(user, http)
        await self.db.commit()
        return response

    async def refresh(self, raw_refresh_token: str, http: Request | None = None) -> AuthResponse:
        token_hash = _sha256(raw_refresh_token)
        stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        result = await self.db.execute(stmt)
        token = result.scalar_one_or_none()
        if token is None:
            raise UnauthorizedException("Invalid refresh token")
        if not token.is_active():
            raise UnauthorizedException("Refresh token expired or revoked")

        user = await self._find_user_by_id(token.user_id)
        if user is None:
            raise UnauthorizedException("Account no longer active")

        token.revoked_at = datetime.now(UTC)  # rotate
        response = await self._issue_tokens(user, http)
        await self.db.commit()
        return response

    async def logout(self, raw_refresh_token: str) -> None:
        token_hash = _sha256(raw_refresh_token)
        stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        result = await self.db.execute(stmt)
        token = result.scalar_one_or_none()
        if token is not None and token.revoked_at is None:
            token.revoked_at = datetime.now(UTC)
        await self.db.commit()

    async def _issue_tokens(self, user: User, http: Request | None) -> AuthResponse:
        access = self.jwt_service.generate_access_token(user.id, user.email, user.role)

        raw_refresh = f"{uuid.uuid4()}.{uuid.uuid4()}"
        expires_at = datetime.now(UTC) + timedelta(seconds=self.refresh_ttl_seconds)
        rt = RefreshToken(
            user_id=user.id,
            token_hash=_sha256(raw_refresh),
            expires_at=expires_at,
        )
        if http is not None:
            rt.user_agent = _truncate(http.headers.get("user-agent"), 400)
            rt.ip_address = http.client.host if http.client else None
        self.db.add(rt)
        await self.db.flush()

        return AuthResponse(
            access_token=access,
            refresh_token=raw_refresh,
            expires_in_seconds=self.jwt_service.get_access_ttl_seconds(),
            user=UserSummary(
                id=user.id,
                email=user.email,
                display_name=user.display_name,
                role=user.role,
            ),
        )
