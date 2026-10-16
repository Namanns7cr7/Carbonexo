"""STORAGE_PROVIDER env-driven factory — mirrors storage/StorageConfig.java's
provider bean selection. Default: local_stub (matches application.yml's default).
"""
from __future__ import annotations

from app.config import settings
from app.storage.base import BlobStorageService
from app.storage.local_stub import LocalStubStorageService


def get_storage_provider(provider_name: str | None = None) -> BlobStorageService:
    name = (provider_name or settings.STORAGE_PROVIDER or "local_stub").lower()
    if name == "local_stub":
        return LocalStubStorageService()
    if name == "gcs":
        from app.storage.gcs import GoogleCloudStorageService

        return GoogleCloudStorageService()
    raise ValueError(f"Unknown STORAGE_PROVIDER: {name}")
