"""Mirrors config/AppConfigServiceTest.java 1:1, using the sqlite_session
fixture (plain CRUD, no Postgres-specific features needed).
"""
from __future__ import annotations

import uuid

import pytest

from app.app_config.models import AppConfig
from app.app_config.service import AppConfigService


@pytest.fixture(autouse=True)
def _clear_cache():
    AppConfigService.invalidate_all()
    yield
    AppConfigService.invalidate_all()


def _unique_key(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4()}"


@pytest.mark.asyncio
async def test_get_returns_value_from_repository(sqlite_session):
    key = _unique_key("ai.provider")
    sqlite_session.add(AppConfig(config_key=key, config_value="gemini", value_type="string"))
    await sqlite_session.commit()

    svc = AppConfigService(sqlite_session)
    assert await svc.get(key) == "gemini"


@pytest.mark.asyncio
async def test_get_caches_and_does_not_hit_repository_twice(sqlite_session, monkeypatch):
    key = _unique_key("k")
    sqlite_session.add(AppConfig(config_key=key, config_value="v", value_type="string"))
    await sqlite_session.commit()

    svc = AppConfigService(sqlite_session)
    calls = {"n": 0}
    orig_execute = sqlite_session.execute

    async def counting_execute(*args, **kwargs):
        calls["n"] += 1
        return await orig_execute(*args, **kwargs)

    monkeypatch.setattr(sqlite_session, "execute", counting_execute)

    await svc.get(key)
    await svc.get(key)
    assert calls["n"] == 1


@pytest.mark.asyncio
async def test_invalidate_forces_repository_reload(sqlite_session, monkeypatch):
    key = _unique_key("k")
    sqlite_session.add(AppConfig(config_key=key, config_value="v", value_type="string"))
    await sqlite_session.commit()

    svc = AppConfigService(sqlite_session)
    calls = {"n": 0}
    orig_execute = sqlite_session.execute

    async def counting_execute(*args, **kwargs):
        calls["n"] += 1
        return await orig_execute(*args, **kwargs)

    monkeypatch.setattr(sqlite_session, "execute", counting_execute)

    await svc.get(key)
    svc.invalidate(key)
    await svc.get(key)
    assert calls["n"] == 2


@pytest.mark.asyncio
async def test_get_or_default_falls_back_when_missing(sqlite_session):
    svc = AppConfigService(sqlite_session)
    assert await svc.get_or_default(_unique_key("missing"), "fallback") == "fallback"


@pytest.mark.asyncio
async def test_typed_getters_parse_values(sqlite_session):
    int_key, dbl_key, bool_key = _unique_key("int"), _unique_key("dbl"), _unique_key("bool")
    sqlite_session.add(AppConfig(config_key=int_key, config_value="42", value_type="int"))
    sqlite_session.add(AppConfig(config_key=dbl_key, config_value="3.5", value_type="decimal"))
    sqlite_session.add(AppConfig(config_key=bool_key, config_value="true", value_type="bool"))
    await sqlite_session.commit()

    svc = AppConfigService(sqlite_session)
    assert await svc.get_int(int_key, 0) == 42
    assert await svc.get_double(dbl_key, 0.0) == 3.5
    assert await svc.get_bool(bool_key, False) is True


@pytest.mark.asyncio
async def test_typed_getters_return_default_on_parse_error(sqlite_session):
    key = _unique_key("bad")
    sqlite_session.add(AppConfig(config_key=key, config_value="not-a-number", value_type="string"))
    await sqlite_session.commit()

    svc = AppConfigService(sqlite_session)
    assert await svc.get_int(key, 7) == 7
    assert await svc.get_double(key, 1.5) == 1.5
