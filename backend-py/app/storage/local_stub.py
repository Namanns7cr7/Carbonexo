"""Local filesystem stub for development — writes to a directory on disk so
the app works without GCP credentials. NEVER use in production. Exact port of
storage/LocalStubStorageService.java.
"""
from __future__ import annotations

import logging
from pathlib import Path

from app.config import settings
from app.storage.base import BlobStorageService

log = logging.getLogger(__name__)


class LocalStubStorageService(BlobStorageService):
    def __init__(self, local_stub_dir: str | None = None) -> None:
        self.base_dir = Path(local_stub_dir if local_stub_dir is not None else settings.STORAGE_LOCAL_DIR)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        log.info("LocalStubStorageService initialized — dir=%s", self.base_dir.resolve())

    def upload(self, data: bytes, path: str, content_type: str) -> str:
        target = self.base_dir / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        log.debug("Local stub: wrote %d bytes to %s", len(data), target)
        return f"file://{target.resolve()}"

    def get_url(self, path: str) -> str:
        return f"file://{(self.base_dir / path).resolve()}"

    def delete(self, path: str) -> None:
        try:
            (self.base_dir / path).unlink(missing_ok=True)
        except OSError:
            log.warning("Local stub delete failed for %s", path, exc_info=True)
