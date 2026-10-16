"""Shared pytest fixtures.

Per the plan: use an in-memory SQLite DB for tests whose logic doesn't depend
on Postgres-specific features (gen_random_uuid/jsonb/triggers/partial unique
indexes) — the auth/users/refresh_tokens path only needs ordinary CRUD, so it
qualifies. Tests that genuinely need Postgres (e.g. exercising the Alembic
baseline migration's raw V1-V5 SQL) should check TEST_DATABASE_URL and skip
cleanly when it's unset and no local Postgres is reachable, rather than
erroring.
"""
from __future__ import annotations

import socket

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.app_config import models as app_config_models  # noqa: F401 - registers tables on Base.metadata
from app.auth import models as auth_models  # noqa: F401 - registers tables on Base.metadata
from app.bill import models as bill_models  # noqa: F401 - registers tables on Base.metadata
from app.carbon import models as carbon_models  # noqa: F401 - registers tables on Base.metadata
from app.credit import models as credit_models  # noqa: F401 - registers tables on Base.metadata
from app.db.base import Base
from app.profile import models as profile_models  # noqa: F401 - registers tables on Base.metadata
from app.reward import models as reward_models  # noqa: F401 - registers tables on Base.metadata


def postgres_reachable(host: str = "127.0.0.1", port: int = 5432, timeout: float = 0.3) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


@pytest_asyncio.fixture
async def sqlite_session() -> AsyncSession:
    """A fresh in-memory SQLite DB per test, schema created from the ORM models
    directly (NOT via the Postgres-only Alembic baseline migration).
    """
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session

    await engine.dispose()
