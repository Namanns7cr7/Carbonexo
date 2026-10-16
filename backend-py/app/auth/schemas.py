"""Pydantic DTOs matching auth/dto/*.java field-for-field."""
from __future__ import annotations

import uuid

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    display_name: str | None = Field(default=None, max_length=120, alias="displayName")

    model_config = {"populate_by_name": True}


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class GoogleLoginRequest(BaseModel):
    id_token: str = Field(min_length=1, alias="idToken")

    model_config = {"populate_by_name": True}


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1, alias="refreshToken")

    model_config = {"populate_by_name": True}


class UserSummary(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str | None = Field(default=None, serialization_alias="displayName")
    role: str

    model_config = {"populate_by_name": True}


class AuthResponse(BaseModel):
    access_token: str = Field(serialization_alias="accessToken")
    refresh_token: str = Field(serialization_alias="refreshToken")
    expires_in_seconds: int = Field(serialization_alias="expiresInSeconds")
    user: UserSummary

    model_config = {"populate_by_name": True}
