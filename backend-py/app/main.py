"""FastAPI application entrypoint — Phase 1 ("core parity"): config/db/errors
foundation + auth + AI/OCR/storage provider abstractions.

Mounts docs at the same paths as the Java backend (springdoc config in
application.yml) so existing tooling/bookmarks keep working:
    docs_url=/swagger-ui.html, openapi_url=/v3/api-docs
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.ai.factory import get_ai_provider
from app.auth.router import router as auth_router
from app.bill.router import router as bill_router
from app.carbon.activities_router import router as activities_router
from app.carbon.router import router as carbon_router
from app.common.problem_details import register_exception_handlers
from app.config import settings
from app.credit.router import router as credit_router
from app.db.session import engine
from app.ocr.factory import get_ocr_provider
from app.profile.router import router as profile_router
from app.reward.router import router as reward_router
from app.storage.factory import get_storage_provider

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL, logging.INFO))
logging.getLogger("app").setLevel(getattr(logging, settings.LOG_LEVEL_APP, logging.DEBUG))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Provider selection happens once at startup, matching the Java config
    # classes (AIConfig/OcrConfig/StorageConfig) selecting a single bean.
    app.state.ai_provider = get_ai_provider()
    app.state.ocr_provider = get_ocr_provider()
    app.state.storage_provider = get_storage_provider()
    try:
        yield
    finally:
        await engine.dispose()


app = FastAPI(
    title="ecotrack-backend",
    docs_url="/swagger-ui.html",
    redoc_url=None,
    openapi_url="/v3/api-docs",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=3600,
)

register_exception_handlers(app)

app.include_router(auth_router)
app.include_router(credit_router)
app.include_router(carbon_router)
app.include_router(activities_router)
app.include_router(bill_router)
app.include_router(profile_router)
app.include_router(reward_router)

# Public health endpoint — matches SecurityConfig.java's PUBLIC matcher
# "/actuator/health/**" (Spring Boot Actuator's default path), so existing
# uptime checks/tooling against the Java backend keep working unmodified.
health_router = APIRouter(tags=["Observability"])


@health_router.get("/actuator/health")
async def health() -> dict[str, str]:
    return {"status": "UP"}


app.include_router(health_router)

Instrumentator().instrument(app).expose(app, endpoint="/actuator/prometheus")
