"""Bill endpoints (authenticated) — mirrors bill/BillController.java paths
and status codes exactly: POST /upload (multipart, field "file"), GET '',
GET /{id}, PUT /{id}/correct.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.bill.schemas import BillCorrectionRequest, BillResponse
from app.bill.service import BillService
from app.common.security_deps import UserPrincipal, get_current_user
from app.db.session import get_db

router = APIRouter(prefix="/api/bills", tags=["Bills"])


def _service_for(request: Request, db: AsyncSession) -> BillService:
    # Providers are selected once at app startup (see app/main.py's lifespan)
    # and shared via app.state, matching the Java config classes selecting a
    # single bean.
    return BillService(db, storage=request.app.state.storage_provider, ocr=request.app.state.ocr_provider)


@router.post("/upload", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
async def upload_bill(
    request: Request,
    file: UploadFile = File(...),
    user: UserPrincipal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BillResponse:
    data = await file.read()
    return await _service_for(request, db).upload(user.user_id, data, file.content_type, file.filename)


@router.get("", response_model=list[BillResponse])
async def list_bills(
    request: Request, user: UserPrincipal = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[BillResponse]:
    return await _service_for(request, db).list_by_user(user.user_id)


@router.get("/{bill_id}", response_model=BillResponse)
async def get_bill(
    bill_id: uuid.UUID,
    request: Request,
    user: UserPrincipal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BillResponse:
    return await _service_for(request, db).get_by_id(bill_id, user.user_id)


@router.put("/{bill_id}/correct", response_model=BillResponse)
async def correct_bill(
    bill_id: uuid.UUID,
    req: BillCorrectionRequest,
    request: Request,
    user: UserPrincipal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BillResponse:
    return await _service_for(request, db).correct(bill_id, user.user_id, req)
