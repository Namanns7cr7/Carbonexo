"""Credit endpoints (authenticated) — mirrors credit/CreditController.java
paths and status codes exactly: GET /api/credits/{balance,history},
POST /api/credits/action?actionKey=...
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.security_deps import UserPrincipal, get_current_user
from app.credit.schemas import CreditBalanceResponse, CreditHistoryResponse
from app.credit.service import CreditService
from app.credit.uuid_util import name_uuid_from_bytes
from app.db.session import get_db

router = APIRouter(prefix="/api/credits", tags=["Credits"])


@router.get("/balance", response_model=CreditBalanceResponse)
async def get_balance(
    user: UserPrincipal = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> CreditBalanceResponse:
    return await CreditService(db).get_balance(user.user_id)


@router.get("/history", response_model=list[CreditHistoryResponse])
async def get_history(
    user: UserPrincipal = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[CreditHistoryResponse]:
    return await CreditService(db).get_history(user.user_id)


@router.post("/action", status_code=status.HTTP_204_NO_CONTENT)
async def complete_action(
    actionKey: str,
    user: UserPrincipal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    action_id = name_uuid_from_bytes(actionKey.encode("utf-8"))
    svc = CreditService(db)
    await svc.on_action_done(user.user_id, action_id)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
