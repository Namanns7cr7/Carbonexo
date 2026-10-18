"""The canned provider ported from ai/CannedFallbackProvider.java: generic,
labelled offline, never claims facts about the user or invents numbers.
"""
from __future__ import annotations

import json
import re

import pytest

from app.ai.canned import OFFLINE_NOTE, CannedFallbackProvider

PROMPTS = [
    "please give a reduction plan", "how is my electricity usage?", "my transport", "a hypothetical scenario",
    "persuasive nudge", "leaderboard summary", "a daily tip", "monthly report", "totally unrelated prompt",
]


def test_reduction_keyword_returns_json_without_invented_savings():
    out = CannedFallbackProvider().generate("please give a reduction plan", "any-model")
    items = json.loads(out)
    assert len(items) == 3
    assert all(i["est_saving_kg"] is None for i in items)


@pytest.mark.parametrize("prompt", PROMPTS)
def test_no_claims_about_the_user_and_no_numbers(prompt):
    out = CannedFallbackProvider().generate(prompt, "any-model")
    for claim in ("you primarily", "decreased by", "your usage trend", "great month", "switching to metro on"):
        assert claim not in out.lower()
    if not out.startswith("["):
        assert out.endswith(OFFLINE_NOTE)
        assert not re.search(r"\d", out), out


def test_provider_name_is_never_a_model_name():
    name = CannedFallbackProvider().provider_name()
    assert name == "canned-fallback"
    assert "gemini" not in name.lower()
