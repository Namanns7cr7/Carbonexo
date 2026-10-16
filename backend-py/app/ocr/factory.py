"""OCR_PROVIDER env-driven factory — mirrors ocr/OcrConfig.java's provider
bean selection. Default: tesseract (matches application.yml's default).
"""
from __future__ import annotations

from app.config import settings
from app.ocr.base import OcrProvider
from app.ocr.tesseract import TesseractOcrProvider


def get_ocr_provider(provider_name: str | None = None) -> OcrProvider:
    name = (provider_name or settings.OCR_PROVIDER or "tesseract").lower()
    if name == "tesseract":
        return TesseractOcrProvider(data_path=settings.TESSDATA_PREFIX or None)
    if name == "google":
        from app.ocr.google_vision import GoogleVisionOcrProvider

        return GoogleVisionOcrProvider()
    raise ValueError(f"Unknown OCR_PROVIDER: {name}")
