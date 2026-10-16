"""FileValidationService — exact port of upload/FileValidationService.java.

`validate()` checks run in this exact order, each raising BadRequestException
immediately on first failure: content-type whitelist -> size limit -> empty
file -> magic-bytes spoofing check. `sha256()` is a separate method, NOT
called inside `validate()` — used by BillService for stored content_hash only
(no dedup lookup exists anywhere, matching the Java reference).
"""
from __future__ import annotations

import hashlib

from app.common.errors import BadRequestException
from app.config import settings

_MAGIC_BYTES: dict[str, bytes] = {
    "application/pdf": b"%PDF",
    "image/png": b"\x89PNG",
    "image/jpeg": b"\xff\xd8\xff",
    "image/jpg": b"\xff\xd8\xff",
}

_MAGIC_FORMAT_NAME: dict[str, str] = {
    "application/pdf": "PDF",
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/jpg": "JPEG",
}


class FileValidationService:
    def __init__(self, max_bytes: int | None = None, allowed_content_types: list[str] | None = None) -> None:
        self.max_bytes = max_bytes if max_bytes is not None else settings.UPLOAD_MAX_BYTES
        self.allowed_content_types = (
            allowed_content_types if allowed_content_types is not None else settings.upload_allowed_content_types_list
        )

    def validate(self, data: bytes, content_type: str | None, original_filename: str | None = None) -> None:
        if content_type is None or content_type.lower() not in self.allowed_content_types:
            raise BadRequestException(
                f"Unsupported file type: {content_type}. Allowed: {', '.join(self.allowed_content_types)}"
            )

        if len(data) > self.max_bytes:
            raise BadRequestException(
                f"File too large: {len(data)} bytes. Maximum: {self.max_bytes} bytes "
                f"({self.max_bytes // 1024 // 1024} MB)"
            )

        if len(data) == 0:
            raise BadRequestException("File is empty")

        self._validate_magic_bytes(data, content_type)

    def _validate_magic_bytes(self, data: bytes, content_type: str) -> None:
        prefix = _MAGIC_BYTES.get(content_type.lower())
        if prefix is None:
            return  # no magic-byte check defined for this content type
        if not data.startswith(prefix):
            fmt = _MAGIC_FORMAT_NAME[content_type.lower()]
            raise BadRequestException(f"File content does not match {fmt} format")

    def sha256(self, data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()
