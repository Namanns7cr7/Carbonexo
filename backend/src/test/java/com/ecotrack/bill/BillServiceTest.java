package com.ecotrack.bill;

import com.ecotrack.credit.CreditService;
import com.ecotrack.ocr.OcrProvider;
import com.ecotrack.storage.BlobStorageService;
import com.ecotrack.upload.FileValidationService;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class BillServiceTest {

    private final BillRepository billRepo = mock(BillRepository.class);
    private final OcrResultRepository ocrRepo = mock(OcrResultRepository.class);
    private final BlobStorageService storage = mock(BlobStorageService.class);
    private final FileValidationService validator = mock(FileValidationService.class);
    private final OcrProvider ocr = mock(OcrProvider.class);
    private final CreditService credits = mock(CreditService.class);
    private final BillService svc = new BillService(billRepo, ocrRepo, storage, validator, ocr, credits);

    @Test
    void uploadFallsBackToManualEntryWhenOcrNativeLibMissing() {
        when(validator.sha256(any())).thenReturn("hash");
        when(storage.upload(any(), anyString(), anyString())).thenReturn("blob://x");
        when(billRepo.save(any(Bill.class))).thenAnswer(i -> i.getArgument(0));
        when(ocr.providerName()).thenReturn("tesseract");
        // missing native library throws an Error (not an Exception)
        when(ocr.extract(any(), anyString())).thenThrow(new UnsatisfiedLinkError("libtesseract.so not found"));

        var resp = svc.upload(UUID.randomUUID(), new byte[]{1, 2, 3}, "image/png", "bill.png");

        // The upload must NOT 500 / be FAILED — it should be ready for manual entry.
        assertEquals("OCR_DONE", resp.status());
    }
}
