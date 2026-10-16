"""Gemini (Vertex AI) provider — STUB.

Implement when cloud creds available: this should wrap the
`google-cloud-aiplatform` (vertexai) SDK, using GCP_PROJECT_ID / GCP_LOCATION
from settings, calling the configured model (AI_DEFAULT_MODEL/AI_FAST_MODEL),
honoring AI_TIMEOUT, and falling back to CannedFallbackProvider per-call when
AI_FALLBACK=true and the Gemini call fails (mirrors ai/AIConfig.java wiring a
composite provider). Not implemented in this Phase-1 pass — see
ai/factory.py, which defaults AI_PROVIDER to "canned" for now specifically
because this class raises.
"""
from __future__ import annotations

from app.ai.base import AIProvider


class GeminiAIProvider(AIProvider):
    def __init__(self, *args, **kwargs) -> None:
        raise NotImplementedError(
            "GeminiAIProvider is not implemented yet — requires GCP_PROJECT_ID + "
            "Application Default Credentials. Use AI_PROVIDER=canned for local dev."
        )

    def generate(self, prompt: str, model: str) -> str:  # pragma: no cover
        raise NotImplementedError

    def provider_name(self) -> str:  # pragma: no cover
        return "gemini"
