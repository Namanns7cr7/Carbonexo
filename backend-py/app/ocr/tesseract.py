"""Tesseract OCR provider — local/free OCR using pytesseract (needs the
`tesseract` binary installed locally). Exact port of the regex parsing in
ocr/TesseractOcrProvider.java, including its confidence heuristic
(found-fields / 3.0) and its "swallow everything, return zero-confidence
result" error handling.
"""
from __future__ import annotations

import io
import logging
import re
from decimal import Decimal, InvalidOperation

import pytesseract
from PIL import Image

from app.ocr.base import OcrExtraction, OcrProvider

log = logging.getLogger(__name__)

_UNITS_RE = re.compile(r"(?i)units?\s*[:\-]?\s*(\d+(?:\.\d+)?)")
_AMOUNT_RE = re.compile(r"(?i)(?:total|amount)\s*[:\-]?\s*(?:₹|Rs\.?)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)")


class TesseractOcrProvider(OcrProvider):
    def __init__(self, data_path: str | None = None) -> None:
        self.data_path = data_path

    def extract(self, file_data: bytes, content_type: str) -> OcrExtraction:
        try:
            config = ""
            if self.data_path:
                config = f'--tessdata-dir "{self.data_path}"'

            if content_type.lower() == "application/pdf":
                # PDFs aren't directly Image.open-able; pytesseract needs an
                # image. A full PDF->image pipeline (e.g. pdf2image/poppler)
                # is out of scope for this dev-safe default — fail soft like
                # the Java provider would on an unreadable input.
                raise ValueError("PDF OCR requires a PDF-to-image step not available in this provider")

            image = Image.open(io.BytesIO(file_data))
            text = pytesseract.image_to_string(image, lang="eng", config=config)

            log.debug("Tesseract extracted %d chars", len(text))

            units = self._parse_units(text)
            amount = self._parse_amount(text)

            found = (1 if units is not None else 0) + (1 if amount is not None else 0)
            confidence = Decimal(found) / Decimal(3)

            return OcrExtraction(
                billing_month=None,
                units_consumed=units,
                bill_amount=amount,
                confidence=confidence,
                raw_json=text,
            )
        except Exception as e:
            log.error("Tesseract OCR failed", exc_info=e)
            return OcrExtraction(
                billing_month=None,
                units_consumed=None,
                bill_amount=None,
                confidence=Decimal(0),
                raw_json=f"Error: {e}",
            )

    def provider_name(self) -> str:
        return "tesseract"

    @staticmethod
    def _parse_units(text: str) -> Decimal | None:
        m = _UNITS_RE.search(text)
        if m:
            try:
                return Decimal(m.group(1))
            except InvalidOperation:
                return None
        return None

    @staticmethod
    def _parse_amount(text: str) -> Decimal | None:
        m = _AMOUNT_RE.search(text)
        if m:
            try:
                return Decimal(m.group(1).replace(",", ""))
            except InvalidOperation:
                return None
        return None
