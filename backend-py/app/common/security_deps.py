"""`get_current_user()` FastAPI dependency replacing JwtAuthenticationFilter.java:
reads `Authorization: Bearer <jwt>`, decodes via jwt_service, and raises the
shared ApiException (-> RFC-7807 401) on any failure. Returns a UserPrincipal-
equivalent (user_id, email, role) — see security/UserPrincipal.java.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import Request

from app.auth.jwt_service import jwt_service
from app.common.errors import UnauthorizedException


@dataclass(frozen=True)
class UserPrincipal:
    user_id: uuid.UUID
    email: str
    role: str


def _extract_bearer_token(request: Request) -> str | None:
    header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not header or not header.lower().startswith("bearer "):
        return None
    return header[len("bearer "):].strip() or header[7:].strip()


async def get_current_user(request: Request) -> UserPrincipal:
    token = _extract_bearer_token(request)
    if not token:
        raise UnauthorizedException("Authentication required")

    claims = jwt_service.parse(token)
    if claims is None:
        raise UnauthorizedException("Authentication required")

    sub = claims.get("sub")
    email = claims.get("email")
    role = claims.get("role")
    if not sub or not email or not role:
        raise UnauthorizedException("Authentication required")

    try:
        user_id = uuid.UUID(sub)
    except (ValueError, TypeError):
        raise UnauthorizedException("Authentication required")

    return UserPrincipal(user_id=user_id, email=email, role=role)
