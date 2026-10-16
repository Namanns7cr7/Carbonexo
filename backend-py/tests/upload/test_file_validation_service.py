"""Mirrors upload/FileValidationServiceTest.java 1:1."""
from __future__ import annotations

import re

import pytest

from app.common.errors import BadRequestException
from app.upload.file_validation import FileValidationService


def _pdf_bytes() -> bytes:
    return b"%PDF-1"


@pytest.fixture
def service() -> FileValidationService:
    return FileValidationService(max_bytes=1024, allowed_content_types=["application/pdf", "image/png", "image/jpeg"])


def test_accepts_valid_pdf(service):
    service.validate(_pdf_bytes(), "application/pdf")  # no exception


def test_accepts_valid_png(service):
    png_bytes = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A])
    service.validate(png_bytes, "image/png")  # no exception


def test_accepts_valid_jpeg(service):
    jpeg_bytes = bytes([0xFF, 0xD8, 0xFF, 0xE0])
    service.validate(jpeg_bytes, "image/jpeg")  # no exception


def test_rejects_unsupported_content_type(service):
    with pytest.raises(BadRequestException, match="Unsupported file type"):
        service.validate(_pdf_bytes(), "application/zip")


def test_rejects_null_content_type(service):
    with pytest.raises(BadRequestException):
        service.validate(_pdf_bytes(), None)


def test_rejects_file_exceeding_max_bytes(service):
    data = bytes([0x25, 0x50, 0x44, 0x46]) + bytes(2048 - 4)
    with pytest.raises(BadRequestException, match="File too large"):
        service.validate(data, "application/pdf")


def test_rejects_empty_file(service):
    with pytest.raises(BadRequestException, match="empty"):
        service.validate(b"", "application/pdf")


def test_rejects_spoofed_content_type(service):
    with pytest.raises(BadRequestException, match="does not match PDF"):
        service.validate(bytes([0x00, 0x01, 0x02, 0x03]), "application/pdf")


def test_sha256_is_stable_and_hex(service):
    h1 = service.sha256(_pdf_bytes())
    h2 = service.sha256(_pdf_bytes())
    assert h1 == h2
    assert len(h1) == 64
    assert re.fullmatch(r"[0-9a-f]{64}", h1)
