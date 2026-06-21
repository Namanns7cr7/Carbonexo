package com.ecotrack.bill;

import com.ecotrack.bill.dto.BillCorrectionRequest;
import com.ecotrack.bill.dto.BillResponse;
import com.ecotrack.exception.ResourceNotFoundException;
import com.ecotrack.ocr.OcrExtraction;
import com.ecotrack.ocr.OcrProvider;
import com.ecotrack.storage.BlobStorageService;
import com.ecotrack.upload.FileValidationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Bill upload flow: validate → store in GCS → trigger OCR → save metadata.
 * Supports manual correction of OCR results.
 */
@Service
public class BillService {

    private static final Logger log = LoggerFactory.getLogger(BillService.class);

    private final BillRepository billRepo;
    private final OcrResultRepository ocrRepo;
    private final BlobStorageService storage;
    private final FileValidationService validator;
    private final OcrProvider ocrProvider;
    private final com.ecotrack.credit.CreditService creditService;

    public BillService(BillRepository billRepo, OcrResultRepository ocrRepo,
                       BlobStorageService storage, FileValidationService validator,
                       OcrProvider ocrProvider, com.ecotrack.credit.CreditService creditService) {
        this.billRepo = billRepo;
        this.ocrRepo = ocrRepo;
        this.storage = storage;
        this.validator = validator;
        this.ocrProvider = ocrProvider;
        this.creditService = creditService;
    }

    @Transactional
    public BillResponse upload(UUID userId, byte[] data, String contentType, String originalFilename) {
        // 1. Validate
        validator.validate(data, contentType, originalFilename);
        String hash = validator.sha256(data);

        // 2. Store in cloud storage (no local file storage)
        String blobPath = "bills/" + userId + "/" + UUID.randomUUID() + getExtension(contentType);
        String blobUrl = storage.upload(data, blobPath, contentType);

        // 3. Save bill record
        Bill bill = new Bill();
        bill.setUserId(userId);
        bill.setBlobContainer("bills");
        bill.setBlobPath(blobPath);
        bill.setBlobUrl(blobUrl);
        bill.setOriginalFilename(originalFilename);
        bill.setContentType(contentType);
        bill.setSizeBytes(data.length);
        bill.setContentHash(hash);
        bill.setStatus("UPLOADED");
        billRepo.save(bill);

        // 4. Trigger OCR (synchronous for now; could be async via queue)
        try {
            bill.setStatus("OCR_PENDING");
            billRepo.save(bill);

            OcrExtraction extraction = ocrProvider.extract(data, contentType);

            OcrResult ocrResult = new OcrResult();
            ocrResult.setBillId(bill.getId());
            ocrResult.setProvider(ocrProvider.providerName());
            ocrResult.setRawJson(extraction.rawJson());
            ocrResult.setParsedBillingMonth(extraction.billingMonth());
            ocrResult.setParsedUnits(extraction.unitsConsumed());
            ocrResult.setParsedAmount(extraction.billAmount());
            ocrResult.setConfidence(extraction.confidence());
            ocrRepo.save(ocrResult);

            // Apply parsed values to bill
            bill.setBillingMonth(extraction.billingMonth());
            bill.setUnitsConsumed(extraction.unitsConsumed());
            bill.setBillAmount(extraction.billAmount());
            bill.setScannedAt(Instant.now());
            bill.setStatus("OCR_DONE");
            billRepo.save(bill);

            log.info("Bill {} OCR completed — units={}, amount={}", bill.getId(),
                    extraction.unitsConsumed(), extraction.billAmount());

        } catch (Throwable e) {
            // Catch Throwable, not just Exception: a missing native lib (Tesseract)
            // throws UnsatisfiedLinkError (a java.lang.Error). OCR is optional here —
            // don't fail the upload; leave the bill ready for MANUAL entry + confirm
            // so the user can still record units/amount and earn credits.
            log.warn("OCR unavailable for bill {} ({}); falling back to manual entry",
                    bill.getId(), e.toString());
            bill.setStatus("OCR_DONE");
            bill.setScannedAt(Instant.now());
            billRepo.save(bill);
        }

        return toResponse(bill);
    }

    public List<BillResponse> listByUser(UUID userId) {
        return billRepo.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId).stream()
                .map(this::toResponse).toList();
    }

    public BillResponse getById(UUID billId, UUID userId) {
        Bill bill = billRepo.findById(billId)
                .orElseThrow(() -> new ResourceNotFoundException("Bill", "id", billId));
        if (!bill.getUserId().equals(userId)) {
            throw new ResourceNotFoundException("Bill", "id", billId);
        }
        return toResponse(bill);
    }

    @Transactional
    public BillResponse correct(UUID billId, UUID userId, BillCorrectionRequest req) {
        Bill bill = billRepo.findById(billId)
                .orElseThrow(() -> new ResourceNotFoundException("Bill", "id", billId));
        if (!bill.getUserId().equals(userId)) {
            throw new ResourceNotFoundException("Bill", "id", billId);
        }

        boolean wasConfirmed = "CONFIRMED".equals(bill.getStatus());

        // Update bill with corrected values
        if (req.billingMonth() != null) bill.setBillingMonth(LocalDate.parse(req.billingMonth() + "-01"));
        if (req.unitsConsumed() != null) bill.setUnitsConsumed(req.unitsConsumed());
        if (req.billAmount() != null) bill.setBillAmount(req.billAmount());
        bill.setStatus("CONFIRMED");
        billRepo.save(bill);

        // Mark OCR result as corrected
        ocrRepo.findByBillId(billId).ifPresent(ocr -> {
            ocr.setCorrected(true);
            ocr.setCorrectedBy(userId);
            ocr.setCorrectedAt(Instant.now());
            ocrRepo.save(ocr);
        });

        if (!wasConfirmed) {
            creditService.onBillUpload(userId, billId);
        }

        log.info("Bill {} manually corrected by user {}", billId, userId);
        return toResponse(bill);
    }

    private BillResponse toResponse(Bill b) {
        return new BillResponse(
                b.getId(), b.getUserId(), b.getBlobUrl(), b.getOriginalFilename(),
                b.getContentType(), b.getSizeBytes(), b.getStatus(),
                b.getBillingMonth() != null ? b.getBillingMonth().toString() : null,
                b.getUnitsConsumed(), b.getBillAmount(), b.getCurrency(),
                b.getCreatedAt() != null ? b.getCreatedAt().toString() : null
        );
    }

    private String getExtension(String contentType) {
        return switch (contentType.toLowerCase()) {
            case "application/pdf" -> ".pdf";
            case "image/png" -> ".png";
            case "image/jpeg", "image/jpg" -> ".jpg";
            default -> "";
        };
    }
}
