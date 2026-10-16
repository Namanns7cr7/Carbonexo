"""OCR provider ABC + result model — mirrors ocr/OcrProvider.java and
ocr/OcrExtraction.java.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class OcrExtraction(BaseModel):
    """Result of OCR extraction from a bill image/PDF."""

    billing_month: date | None = None
    units_consumed: Decimal | None = None
    bill_amount: Decimal | None = None
    confidence: Decimal = Decimal(0)  # 0.0 - 1.0
    raw_json: str | None = None  # full provider response, for auditing


class OcrProvider(ABC):
    @abstractmethod
    def extract(self, file_data: bytes, content_type: str) -> OcrExtraction:
        """Extract billing data from the given file bytes."""

    @abstractmethod
    def provider_name(self) -> str:
        """Provider name for audit logging."""
