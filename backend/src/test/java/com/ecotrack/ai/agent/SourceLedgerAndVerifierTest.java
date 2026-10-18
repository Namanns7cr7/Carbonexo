package com.ecotrack.ai.agent;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SourceLedgerAndVerifierTest {

    @Test
    void groupedMarkersAreNormalisedAndUnknownOnesStripped() {
        assertEquals("a [S1][S2][S3] b [S2][S4]", SourceLedger.normalize("a [S1, S2, S3] b [S2; S4]"));
        assertEquals("x [S1][S2][S3]", SourceLedger.normalize("x [S1-S3]"));
        SourceLedger l = new SourceLedger();
        l.cite("k1", "factor_source", "niti-2026-power", "NITI", "u", "Annexure E", "CANDIDATE");
        String text = l.stripUnknownMarkers(SourceLedger.normalize("Grid [S1, S9] done"));
        assertEquals("Grid [S1] done", text);
        assertEquals(List.of("niti-2026-power"), l.cited(text).stream().map(SourceLedger.Source::sourceId).toList());
    }

    @Test
    void verifierAcceptsToolNumbersRoundingAndUnitRestatements() {
        List<Map<String, Object>> tools = List.of(Map.of("kg_min", 38.191, "kg_max", 92.749, "factor_value", 0.710));
        assertTrue(AnswerVerifier.verify("between 38.19 kg and 92.75 kg", tools, "").ok());
        assertTrue(AnswerVerifier.verify("about 38 kg to 93 kg", tools, "").ok());
        assertTrue(AnswerVerifier.verify("I drive 20 km", tools, "I drive 20 km every day").ok());
        assertTrue(AnswerVerifier.verify("0.71 kg per kWh is 710 g", tools, "").ok());
    }

    @Test
    void verifierRejectsInventedNumbersAndSavedLanguage() {
        List<Map<String, Object>> tools = List.of(Map.of("kg", 7.8));
        AnswerVerifier.Verdict v = AnswerVerifier.verify("You would emit 7.8 kg, about 12 kg less than a car.", tools, "");
        assertEquals(List.of("12 kg"), v.ungroundedNumbers());
        assertTrue(AnswerVerifier.verify("You have saved 7.8 kg.", tools, "").savedLanguage());
        assertFalse(AnswerVerifier.verify("You would avoid 7.8 kg (hypothetical).", tools, "").savedLanguage());
        String stripped = AnswerVerifier.stripUngrounded("Bus: 7.8 kg. That is 12 kg less. Take the bus.", v);
        assertEquals("Bus: 7.8 kg. Take the bus.", stripped);
    }

    @Test
    void citationMarkersAreNotMistakenForQuantities() {
        assertTrue(AnswerVerifier.verify("Grid factor [S1] and car [S2].", List.of(), "").ok());
    }

    @Test
    void smallInventedFactorsAreNotGroundedByUnrelatedNumbers() {
        // regression: an absolute 0.051 tolerance accepted any small factor whenever 0 or x/1000 was nearby
        List<Map<String, Object>> results = List.of(Map.of("kg", 18, "status", "OK", "occupancy", 1));
        assertFalse(AnswerVerifier.verify("Metro emits 0.03 kg per km.", results, "metro?").ok());
        assertFalse(AnswerVerifier.verify("Rail is 0.035 kg per km.", results, "rail?").ok());
        // genuine restatements still pass: rounding to the stated precision, and g <-> kg
        List<Map<String, Object>> factor = List.of(Map.of("factor_value", 0.015161, "kg", 1.378068));
        assertTrue(AnswerVerifier.verify("The bus is 0.0152 kg per km and the trip 1.38 kg less.", factor, "bus?").ok());
        assertTrue(AnswerVerifier.verify("That is about 15.2 g per km.", factor, "bus?").ok());
        assertFalse(AnswerVerifier.verify("The bus is 0.025 kg per km.", factor, "bus?").ok());
    }
}
