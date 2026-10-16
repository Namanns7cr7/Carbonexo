"""Blob storage ABC — mirrors storage/BlobStorageService.java. Implementations
must NOT leak provider-specific types.
"""
from __future__ import annotations

from abc import ABC, abstractmethod


class BlobStorageService(ABC):
    @abstractmethod
    def upload(self, data: bytes, path: str, content_type: str) -> str:
        """Upload bytes and return the public/signed URL."""

    @abstractmethod
    def get_url(self, path: str) -> str:
        """Get a URL for an existing blob."""

    @abstractmethod
    def delete(self, path: str) -> None:
        """Delete a blob."""
