"""Unit tests for the regex parsing ported from TesseractOcrProvider.java,
with pytesseract mocked so no `tesseract` binary is needed in this sandbox.
"""
from __future__ import annotations

from decimal import Decimal
from unittest.mock import patch

from app.ocr.tesseract import TesseractOcrProvider


def _fake_png_bytes() -> bytes:
    from io import BytesIO

    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (10, 10), color="white").save(buf, format="PNG")
    return buf.getvalue()


def test_parses_units_and_amount_from_text():
    provider = TesseractOcrProvider()
    text = "Units: 245.5\nTotal: Rs. 1,234.56\n"
    with patch("app.ocr.tesseract.pytesseract.image_to_string", return_value=text):
        result = provider.extract(_fake_png_bytes(), "image/png")

    assert result.units_consumed == Decimal("245.5")
    assert result.bill_amount == Decimal("1234.56")
    assert result.confidence == Decimal(2) / Decimal(3)
    assert result.raw_json == text


def test_partial_match_lowers_confidence():
    provider = TesseractOcrProvider()
    text = "No usable fields here"
    with patch("app.ocr.tesseract.pytesseract.image_to_string", return_value=text):
        result = provider.extract(_fake_png_bytes(), "image/png")

    assert result.units_consumed is None
    assert result.bill_amount is None
    assert result.confidence == Decimal(0)


def test_amount_with_rupee_symbol():
    provider = TesseractOcrProvider()
    text = "amount: ₹2500.00"
    with patch("app.ocr.tesseract.pytesseract.image_to_string", return_value=text):
        result = provider.extract(_fake_png_bytes(), "image/png")

    assert result.bill_amount == Decimal("2500.00")


def test_provider_name():
    assert TesseractOcrProvider().provider_name() == "tesseract"


def test_unreadable_input_fails_soft_with_zero_confidence():
    provider = TesseractOcrProvider()
    result = provider.extract(b"not an image", "application/pdf")
    assert result.confidence == Decimal(0)
    assert result.raw_json is not None and result.raw_json.startswith("Error:")
