"""Issues and validates short-lived access JWTs (HS256) — mirrors JwtService.java.

Claims: sub (user id), iss, iat, exp, email, role. TTL and issuer come from
settings (JWT_ACCESS_TTL / JWT_ISSUER), matching application.yml.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt

from app.config import settings


class JwtService:
    def __init__(self, secret: str | None = None, access_ttl_seconds: int | None = None,
                 issuer: str | None = None) -> None:
        self.secret = secret if secret is not None else settings.JWT_SECRET
        self.access_ttl_seconds = access_ttl_seconds if access_ttl_seconds is not None else settings.JWT_ACCESS_TTL
        self.issuer = issuer if issuer is not None else settings.JWT_ISSUER

    def generate_access_token(self, user_id: uuid.UUID, email: str, role: str) -> str:
        now = datetime.now(UTC)
        payload = {
            "iss": self.issuer,
            "sub": str(user_id),
            "email": email,
            "role": role,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(seconds=self.access_ttl_seconds)).timestamp()),
        }
        return jwt.encode(payload, self.secret, algorithm="HS256")

    def parse(self, token: str) -> dict[str, Any] | None:
        """Return parsed claims, or None if the token is invalid/expired/wrong issuer
        — mirrors JwtService.parse() swallowing all exceptions into a null result.
        """
        try:
            return jwt.decode(
                token,
                self.secret,
                algorithms=["HS256"],
                issuer=self.issuer,
                options={"require": ["exp", "iat", "sub"]},
            )
        except JWTError:
            return None

    def get_access_ttl_seconds(self) -> int:
        return self.access_ttl_seconds


jwt_service = JwtService()
