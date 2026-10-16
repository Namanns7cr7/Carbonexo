"""Activity-log endpoints — mirrors carbon/ActivityLogController.java paths
and status codes exactly: POST '', GET ?from=&to=, DELETE /{id} (soft-delete,
403 if not owner).
"""
from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.carbon.models import ActivityLog
from app.carbon.schemas import ActivityLogRequest, ActivityLogResponse
from app.common.errors import ForbiddenException, ResourceNotFoundException
from app.common.security_deps import UserPrincipal, get_current_user
from app.db.session import get_db

router = APIRouter(prefix="/api/activities", tags=["Activities"])


def _to_response(a: ActivityLog) -> ActivityLogResponse:
    return ActivityLogResponse(
        id=a.id,
        category=a.category,
        factor_key=a.factor_key,
        label=a.label,
        emoji=a.emoji,
        quantity=a.quantity,
        unit=a.unit,
        co2_kg=a.co2_kg,
        note=a.note,
        activity_date=a.activity_date.isoformat(),
        source=a.source,
    )


@router.post("", response_model=ActivityLogResponse, status_code=status.HTTP_201_CREATED)
async def create_activity(
    req: ActivityLogRequest,
    user: UserPrincipal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ActivityLogResponse:
    activity = ActivityLog(
        user_id=user.user_id,
        category=req.category,
        factor_key=req.factor_key,
        label=req.label,
        emoji=req.emoji,
        quantity=req.quantity,
        unit=req.unit,
        co2_kg=req.co2_kg,
        note=req.note,
        activity_date=date.fromisoformat(req.activity_date),
        source="manual",  # always forced server-side, regardless of client input
    )
    db.add(activity)
    await db.flush()
    await db.commit()
    return _to_response(activity)


@router.get("", response_model=list[ActivityLogResponse])
async def list_activities(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    user: UserPrincipal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ActivityLogResponse]:
    stmt = select(ActivityLog).where(ActivityLog.user_id == user.user_id, ActivityLog.deleted_at.is_(None))
    if from_ and to:
        stmt = stmt.where(
            ActivityLog.activity_date >= date.fromisoformat(from_),
            ActivityLog.activity_date <= date.fromisoformat(to),
        )
    stmt = stmt.order_by(ActivityLog.activity_date.desc(), ActivityLog.created_at.desc())
    result = await db.execute(stmt)
    return [_to_response(a) for a in result.scalars().all()]


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_activity(
    activity_id: uuid.UUID,
    user: UserPrincipal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    result = await db.execute(select(ActivityLog).where(ActivityLog.id == activity_id))
    activity = result.scalar_one_or_none()
    if activity is None:
        raise ResourceNotFoundException.of("ActivityLog", activity_id)
    if activity.user_id != user.user_id:
        raise ForbiddenException()
    activity.deleted_at = datetime.now(UTC)
    await db.flush()
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
