"""Mirrors bill/BillServiceTest.java 1:1 (OCR failure must fall back to
manual entry — status OCR_DONE, never FAILED, never a raised/500 error)."""
from __future__ import annotations

import uuid

import pytest

from app.bill.service import BillService
from app.ocr.base import OcrProvider
from app.storage.base import BlobStorageService
from app.upload.file_validation import FileValidationService


class _FakeStorage(BlobStorageService):
    def upload(self, data: bytes, path: str, content_type: str) -> str:
        return "blob://x"

    def get_url(self, path: str) -> str:
        return "blob://x"

    def delete(self, path: str) -> None:
        pass


class _OcrRaisesMissingNativeLib(OcrProvider):
    def extract(self, file_data: bytes, content_type: str):
        raise RuntimeError("libtesseract.so not found")  # Python stand-in for java.lang.UnsatisfiedLinkError

    def provider_name(self) -> str:
        return "tesseract"


@pytest.mark.asyncio
async def test_upload_falls_back_to_manual_entry_when_ocr_native_lib_missing(sqlite_session):
    svc = BillService(
        sqlite_session,
        storage=_FakeStorage(),
        ocr=_OcrRaisesMissingNativeLib(),
        validator=FileValidationService(max_bytes=10_000_000, allowed_content_types=["image/png"]),
    )

    png_bytes = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    resp = await svc.upload(uuid.uuid4(), png_bytes, "image/png", "bill.png")

    assert resp.status == "OCR_DONE"  # must NOT be "FAILED", must not raise
