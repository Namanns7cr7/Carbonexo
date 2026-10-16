"""AI_PROVIDER env-driven factory — mirrors ai/AIConfig.java's provider bean
selection.

NOTE: application.yml defaults AI_PROVIDER to "gemini", but this Phase-1 pass
only ships a dev-safe canned implementation (GeminiAIProvider is a stub that
raises NotImplementedError — see app/ai/gemini.py). The default here is
therefore "canned" so the app boots with zero cloud credentials; flip
AI_PROVIDER=gemini (and implement gemini.py) once Vertex AI creds are wired up.
"""
from __future__ import annotations

from app.ai.base import AIProvider
from app.ai.canned import CannedFallbackProvider
from app.config import settings


def get_ai_provider(provider_name: str | None = None) -> AIProvider:
    name = (provider_name or settings.AI_PROVIDER or "canned").lower()
    if name == "canned":
        return CannedFallbackProvider()
    if name == "gemini":
        from app.ai.gemini import GeminiAIProvider

        return GeminiAIProvider()
    raise ValueError(f"Unknown AI_PROVIDER: {name}")
