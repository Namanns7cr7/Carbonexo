"""Async SQLAlchemy engine + FastAPI `get_db()` dependency."""
from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings


def to_async_dsn(raw_url: str) -> str:
    """Translate a jdbc:postgresql:// (or plain postgresql://) DSN into the
    postgresql+asyncpg:// form asyncpg/SQLAlchemy need. Idempotent: an
    already-correct DSN (including a sqlite+aiosqlite:// one used in tests)
    passes through unchanged.
    """
    url = raw_url
    url = url.removeprefix("jdbc:")
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]
    elif url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://"):]
    return url


def build_engine_url() -> str:
    dsn = to_async_dsn(settings.DB_URL)
    # application.yml carries user/password separately from the JDBC URL;
    # inject them if the DSN doesn't already embed credentials.
    if "@" not in dsn and dsn.startswith("postgresql+asyncpg://"):
        rest = dsn[len("postgresql+asyncpg://"):]
        dsn = f"postgresql+asyncpg://{settings.DB_USER}:{settings.DB_PASSWORD}@{rest}"
    return dsn


engine: AsyncEngine = create_async_engine(
    build_engine_url(),
    pool_size=settings.DB_POOL_MAX,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
