"""AI provider ABC — mirrors ai/AIProvider.java. No provider-specific code
should leak into business services; everything goes through this interface.
"""
from __future__ import annotations

from abc import ABC, abstractmethod


class AIProvider(ABC):
    @abstractmethod
    def generate(self, prompt: str, model: str) -> str:
        """Generate a text completion from a prompt."""

    @abstractmethod
    def provider_name(self) -> str:
        """Provider name for audit logging."""
