"""BillService — exact port of bill/BillService.java: upload orchestration
(validate -> storage upload -> OCR extract -> persist Bill + OcrResult with
status transitions) and manual correction (triggers CreditService.on_bill_upload
on the first CONFIRMED transition only).
"""
from __future__ import annotations

import logging
import uuid
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.bill.models import Bill, OcrResult
from app.bill.schemas import BillCorrectionRequest, BillResponse
from app.common.errors import ResourceNotFoundException
from app.credit.service import CreditService
from app.ocr.base import OcrProvider
from app.ocr.factory import get_ocr_provider
from app.storage.base import BlobStorageService
from app.storage.factory import get_storage_provider
from app.upload.file_validation import FileValidationService

log = logging.getLogger(__name__)

_EXTENSION_BY_CONTENT_TYPE = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
}


class BillService:
    def __init__(
        self,
        db: AsyncSession,
        storage: BlobStorageService | None = None,
        ocr: OcrProvider | None = None,
        validator: FileValidationService | None = None,
        credit_service: CreditService | None = None,
    ) -> None:
        self.db = db
        self.storage = storage or get_storage_provider()
        self.ocr = ocr or get_ocr_provider()
        self.validator = validator or FileValidationService()
        self.credit_service = credit_service or CreditService(db)

    async def upload(
        self, user_id: uuid.UUID, data: bytes, content_type: str | None, original_filename: str | None
    ) -> BillResponse:
        self.validator.validate(data, content_type, original_filename)
        content_hash = self.validator.sha256(data)

        extension = _EXTENSION_BY_CONTENT_TYPE.get((content_type or "").lower(), "")
        blob_path = f"bills/{user_id}/{uuid.uuid4()}{extension}"
        blob_url = self.storage.upload(data, blob_path, content_type)

        bill = Bill(
            user_id=user_id,
            blob_container="bills",
            blob_path=blob_path,
            blob_url=blob_url,
            original_filename=original_filename,
            content_type=content_type,
            size_bytes=len(data),
            content_hash=content_hash,
            status="UPLOADED",
        )
        self.db.add(bill)
        await self.db.flush()

        bill.status = "OCR_PENDING"
        await self.db.flush()

        try:
            extraction = self.ocr.extract(data, content_type)
            ocr_result = OcrResult(
                bill_id=bill.id,
                provider=self.ocr.provider_name(),
                raw_json=extraction.raw_json,
                parsed_billing_month=extraction.billing_month,
                parsed_units=extraction.units_consumed,
                parsed_amount=extraction.bill_amount,
                confidence=extraction.confidence,
            )
            self.db.add(ocr_result)

            bill.billing_month = extraction.billing_month
            bill.units_consumed = extraction.units_consumed
            bill.bill_amount = extraction.bill_amount
            bill.scanned_at = datetime.now(UTC)
            bill.status = "OCR_DONE"
        except Exception:
            # OCR is optional — upload must never fail/500 just because OCR did
            # (e.g. a missing native Tesseract lib). Leave the bill ready for
            # manual entry so the user can still confirm and earn credits.
            log.warning("OCR extraction failed for bill %s; falling back to manual entry", bill.id, exc_info=True)
            bill.scanned_at = datetime.now(UTC)
            bill.status = "OCR_DONE"

        await self.db.flush()
        await self.db.commit()
        return self._to_response(bill)

    async def list_by_user(self, user_id: uuid.UUID) -> list[BillResponse]:
        stmt = (
            select(Bill)
            .where(Bill.user_id == user_id, Bill.deleted_at.is_(None))
            .order_by(Bill.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return [self._to_response(b) for b in result.scalars().all()]

    async def _find_owned(self, bill_id: uuid.UUID, user_id: uuid.UUID) -> Bill:
        result = await self.db.execute(select(Bill).where(Bill.id == bill_id))
        bill = result.scalar_one_or_none()
        # Ownership mismatch and not-found both return the same 404, matching
        # the Java reference exactly (intentionally indistinguishable, to
        # avoid leaking the existence of another user's bill).
        if bill is None or bill.user_id != user_id:
            raise ResourceNotFoundException.of("Bill", bill_id)
        return bill

    async def get_by_id(self, bill_id: uuid.UUID, user_id: uuid.UUID) -> BillResponse:
        bill = await self._find_owned(bill_id, user_id)
        return self._to_response(bill)

    async def correct(self, bill_id: uuid.UUID, user_id: uuid.UUID, req: BillCorrectionRequest) -> BillResponse:
        bill = await self._find_owned(bill_id, user_id)
        was_confirmed = bill.status == "CONFIRMED"

        if req.billing_month is not None:
            bill.billing_month = date.fromisoformat(f"{req.billing_month}-01")
        if req.units_consumed is not None:
            bill.units_consumed = req.units_consumed
        if req.bill_amount is not None:
            bill.bill_amount = req.bill_amount

        bill.status = "CONFIRMED"
        await self.db.flush()

        ocr_result_stmt = select(OcrResult).where(OcrResult.bill_id == bill_id)
        ocr_result = (await self.db.execute(ocr_result_stmt)).scalar_one_or_none()
        if ocr_result is not None:
            ocr_result.corrected = True
            ocr_result.corrected_by = user_id
            ocr_result.corrected_at = datetime.now(UTC)
            await self.db.flush()

        if not was_confirmed:
            await self.credit_service.on_bill_upload(user_id, bill_id)

        await self.db.commit()
        log.info("Bill %s corrected/confirmed by user %s", bill_id, user_id)
        return self._to_response(bill)

    @staticmethod
    def _to_response(b: Bill) -> BillResponse:
        return BillResponse(
            id=b.id,
            user_id=b.user_id,
            blob_url=b.blob_url,
            original_filename=b.original_filename,
            content_type=b.content_type,
            size_bytes=b.size_bytes,
            status=b.status,
            billing_month=b.billing_month.isoformat() if b.billing_month else None,
            units_consumed=b.units_consumed,
            bill_amount=b.bill_amount,
            currency=b.currency,
            created_at=b.created_at.isoformat() if b.created_at else None,
        )
