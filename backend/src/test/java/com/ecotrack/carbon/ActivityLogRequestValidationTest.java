package com.ecotrack.carbon;

import com.ecotrack.carbon.dto.ActivityLogRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ActivityLogRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private ActivityLogRequest req(double qty, double co2) {
        return new ActivityLogRequest("travel", "car_petrol", "Drive", null, qty, "km", co2, null, "2026-10-18");
    }

    @Test
    void acceptsAnOrdinaryLog() {
        assertTrue(validator.validate(req(12.5, 2.1)).isEmpty());
    }

    @Test
    void rejectsAbsurdEmissionsThatWouldSkewLeaderboardsAndScores() {
        var violations = validator.validate(req(12.5, 1_000_000_000));
        assertEquals(1, violations.size());
        assertEquals("co2Kg", violations.iterator().next().getPropertyPath().toString());
    }

    @Test
    void rejectsAbsurdQuantities() {
        assertFalse(validator.validate(req(5_000_000, 2.1)).isEmpty());
    }
}
