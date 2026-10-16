"""Google Cloud Vision OCR provider — STUB.

Implement when cloud creds available: use `google-cloud-vision`'s
ImageAnnotatorClient with GCP_PROJECT_ID / Application Default Credentials,
run text detection, then apply the same regex parsing as
app/ocr/tesseract.py (ported from TesseractOcrProvider.java, which itself
says "Use the same regex parsing as Google Vision").
"""
from __future__ import annotations

from app.ocr.base import OcrExtraction, OcrProvider


class GoogleVisionOcrProvider(OcrProvider):
    def __init__(self, *args, **kwargs) -> None:
        raise NotImplementedError(
            "GoogleVisionOcrProvider is not implemented yet — requires GCP_PROJECT_ID + "
            "Application Default Credentials. Use OCR_PROVIDER=tesseract for local dev."
        )

    def extract(self, file_data: bytes, content_type: str) -> OcrExtraction:  # pragma: no cover
        raise NotImplementedError

    def provider_name(self) -> str:  # pragma: no cover
        return "google"
