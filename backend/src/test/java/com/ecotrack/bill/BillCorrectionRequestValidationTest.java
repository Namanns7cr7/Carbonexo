package com.ecotrack.bill;

import com.ecotrack.bill.dto.BillCorrectionRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class BillCorrectionRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void acceptsPartialAndFullCorrections() {
        assertTrue(validator.validate(new BillCorrectionRequest(null, null, null)).isEmpty());
        assertTrue(validator.validate(new BillCorrectionRequest("2026-09", new BigDecimal("320.5"), new BigDecimal("2100"))).isEmpty());
    }

    @Test
    void rejectsMalformedMonthThatWouldOtherwiseSurfaceAsA500() {
        assertFalse(validator.validate(new BillCorrectionRequest("2026-9", null, null)).isEmpty());
        assertFalse(validator.validate(new BillCorrectionRequest("2026-13", null, null)).isEmpty());
        assertFalse(validator.validate(new BillCorrectionRequest("not-a-month", null, null)).isEmpty());
    }

    @Test
    void rejectsNegativeOrAbsurdReadings() {
        assertFalse(validator.validate(new BillCorrectionRequest(null, new BigDecimal("-1"), null)).isEmpty());
        assertFalse(validator.validate(new BillCorrectionRequest(null, new BigDecimal("1e9"), null)).isEmpty());
        assertFalse(validator.validate(new BillCorrectionRequest(null, null, new BigDecimal("-5"))).isEmpty());
    }
}
