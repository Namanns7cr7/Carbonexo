"""Sanity test for the keyword-matched canned AI provider ported from
ai/CannedFallbackProvider.java.
"""
from __future__ import annotations

from app.ai.canned import CannedFallbackProvider


def test_reduction_keyword_returns_json_recommendations():
    out = CannedFallbackProvider().generate("please give a reduction plan", "any-model")
    assert "Switch to metro" in out


def test_electricity_keyword():
    out = CannedFallbackProvider().generate("how is my electricity usage?", "any-model")
    assert "energy-efficient appliances" in out


def test_default_fallback_for_unmatched_prompt():
    out = CannedFallbackProvider().generate("totally unrelated prompt", "any-model")
    assert "sustainability coach" in out


def test_provider_name():
    assert CannedFallbackProvider().provider_name() == "canned"
