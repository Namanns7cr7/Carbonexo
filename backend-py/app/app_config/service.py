"""Runtime configuration service — mirrors config/AppConfigService.java exactly:
reads from the `app_config` table with an in-memory cache (5 min TTL), used by
engines (credits, OCR/AI/storage provider selection in Java — providers are
chosen once at Python startup instead, see app/*/factory.py) to fetch
runtime-editable values without a restart.

The cache is a MODULE-level (class-level) dict rather than per-instance, since
AppConfigService is constructed fresh per request (one `db` session each) the
same way AuthService is — a per-instance cache would never actually cache
anything across requests. This mirrors the effect of the Java singleton
@Service bean's instance-level cache.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import ClassVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.app_config.models import AppConfig

log = logging.getLogger(__name__)

_CACHE_TTL_SECONDS = 5 * 60  # 5 minutes


@dataclass
class _CacheEntry:
    value: str | None
    created_at: float

    def is_expired(self) -> bool:
        return (time.monotonic() - self.created_at) > _CACHE_TTL_SECONDS


class AppConfigService:
    # Shared across instances/requests, matching the Java singleton bean's cache.
    _cache: ClassVar[dict[str, _CacheEntry]] = {}

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, key: str) -> str | None:
        entry = self._cache.get(key)
        if entry is not None and not entry.is_expired():
            return entry.value

        result = await self.db.execute(select(AppConfig).where(AppConfig.config_key == key))
        cfg = result.scalar_one_or_none()
        value = cfg.config_value if cfg is not None else None
        self._cache[key] = _CacheEntry(value=value, created_at=time.monotonic())
        return value

    async def get_or_default(self, key: str, default_value: str) -> str:
        value = await self.get(key)
        return value if value is not None else default_value

    async def get_int(self, key: str, default_value: int) -> int:
        value = await self.get(key)
        if value is None:
            return default_value
        try:
            return int(value)
        except ValueError:
            return default_value

    async def get_double(self, key: str, default_value: float) -> float:
        value = await self.get(key)
        if value is None:
            return default_value
        try:
            return float(value)
        except ValueError:
            return default_value

    async def get_bool(self, key: str, default_value: bool) -> bool:
        value = await self.get(key)
        if value is None:
            return default_value
        # Mirrors Java's Boolean.parseBoolean: anything other than a
        # case-insensitive "true" is false (never raises).
        return value.lower() == "true"

    def invalidate(self, key: str) -> None:
        """Invalidate cache for a specific key (e.g. after admin update)."""
        self._cache.pop(key, None)

    @classmethod
    def invalidate_all(cls) -> None:
        """Invalidate entire cache."""
        cls._cache.clear()
