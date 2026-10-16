"""Authentication endpoints (public) — mirrors auth/AuthController.java paths
and status codes exactly: POST /api/auth/{register,login,google,refresh,logout}.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.schemas import AuthResponse, GoogleLoginRequest, LoginRequest, RefreshRequest, RegisterRequest
from app.auth.service import AuthService
from app.db.session import get_db

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, http: Request, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    return await AuthService(db).register(req, http)


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, http: Request, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    return await AuthService(db).login(req, http)


@router.post("/google", response_model=AuthResponse)
async def google(req: GoogleLoginRequest, http: Request, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    return await AuthService(db).login_with_google(req.id_token, http)


@router.post("/refresh", response_model=AuthResponse)
async def refresh(req: RefreshRequest, http: Request, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    return await AuthService(db).refresh(req.refresh_token, http)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(req: RefreshRequest, db: AsyncSession = Depends(get_db)) -> Response:
    await AuthService(db).logout(req.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
