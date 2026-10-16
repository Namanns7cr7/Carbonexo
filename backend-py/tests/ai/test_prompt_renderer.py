"""Mirrors ai/PromptRendererTest.java exactly (same cases, same assertions)."""
from __future__ import annotations

from dataclasses import dataclass

import pytest

from app.ai.prompt_renderer import PromptRenderer


@dataclass
class _FakeTemplate:
    body: str


class _FakeRepo:
    def __init__(self, body: str | None) -> None:
        self._body = body

    async def find_latest_active_by_key(self, key: str):
        if self._body is None:
            return None
        return _FakeTemplate(body=self._body)


@pytest.mark.asyncio
async def test_substitutes_placeholders_with_values():
    renderer = PromptRenderer(_FakeRepo("Hello {{name}}, your top source is {{source}}."))
    out = await renderer.render("coach", {"name": "Yash", "source": "travel"})
    assert out == "Hello Yash, your top source is travel."


@pytest.mark.asyncio
async def test_leaves_unknown_placeholder_intact():
    renderer = PromptRenderer(_FakeRepo("Hi {{name}} from {{city}}"))
    out = await renderer.render("coach", {"name": "Yash"})
    assert out == "Hi Yash from {{city}}"


@pytest.mark.asyncio
async def test_handles_template_with_no_placeholders():
    renderer = PromptRenderer(_FakeRepo("Static prompt body"))
    out = await renderer.render("coach", {})
    assert out == "Static prompt body"


@pytest.mark.asyncio
async def test_treats_replacement_literally():
    # a value containing $ or \ must not be interpreted as a regex backreference
    renderer = PromptRenderer(_FakeRepo("Path: {{p}}"))
    out = await renderer.render("coach", {"p": "C:\\temp\\$x"})
    assert out == "Path: C:\\temp\\$x"


@pytest.mark.asyncio
async def test_returns_fallback_when_template_missing():
    renderer = PromptRenderer(_FakeRepo(None))
    out = await renderer.render("missing", {})
    assert "No template found" in out
    assert "missing" in out
