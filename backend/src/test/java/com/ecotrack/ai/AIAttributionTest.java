package com.ecotrack.ai;

import com.ecotrack.config.AppProperties;
import com.google.api.gax.grpc.GrpcStatusCode;
import com.google.api.gax.rpc.ApiExceptionFactory;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import org.junit.jupiter.api.Test;

import java.util.concurrent.TimeoutException;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

/** Phase 1: failures are classified and fallback text is never attributed to the model. */
class AIAttributionTest {

    private static AppProperties props(String provider, boolean fallback) {
        return new AppProperties(null, null, null, null, null, null,
                new AppProperties.Ai(provider, "gemini-2.5-flash", "gemini-2.5-flash", 30, fallback,
                        new AppProperties.Ai.Gemini("carbonexo", "asia-south1")));
    }

    @Test
    void classifiesVertexStatusCodes() {
        assertEquals(AIFailureKind.MODEL_NOT_FOUND, AIFailureKind.classify(
                ApiExceptionFactory.createException(new RuntimeException("404"), GrpcStatusCode.of(Status.Code.NOT_FOUND), false)));
        assertEquals(AIFailureKind.ENDPOINT, AIFailureKind.classify(new StatusRuntimeException(Status.UNIMPLEMENTED)));
        assertEquals(AIFailureKind.AUTH, AIFailureKind.classify(new StatusRuntimeException(Status.PERMISSION_DENIED)));
        assertEquals(AIFailureKind.QUOTA, AIFailureKind.classify(new RuntimeException(new StatusRuntimeException(Status.RESOURCE_EXHAUSTED))));
        assertEquals(AIFailureKind.TIMEOUT, AIFailureKind.classify(new RuntimeException(new TimeoutException())));
        assertEquals(AIFailureKind.UNKNOWN, AIFailureKind.classify(new RuntimeException("?")));
        assertTrue(AIFailureKind.MODEL_NOT_FOUND.isConfiguration());
        assertFalse(AIFailureKind.QUOTA.isConfiguration());
    }

    @Test
    void startupProbeNeverHoldsUpReadinessEvenWhenVertexHangs() throws Exception {
        java.util.concurrent.CountDownLatch release = new java.util.concurrent.CountDownLatch(1);
        AIProvider hanging = new AIProvider() {
            @Override public String generate(String p, String m) {
                try { release.await(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                throw new AIProviderException(AIFailureKind.TIMEOUT, m, "timeout", null);
            }
            @Override public String providerName() { return "gemini"; }
        };
        AiModelProbe probe = new AiModelProbe(AIConfig.withCannedFallback(hanging), props("gemini", true));
        long t0 = System.nanoTime();
        Thread t = probe.start();
        assertTrue((System.nanoTime() - t0) / 1_000_000 < 500, "probe blocked the caller");
        assertTrue(t.isDaemon());
        assertTrue(t.isAlive());
        release.countDown();
        t.join(5_000);
        assertFalse(t.isAlive());
    }

    @Test
    void fallbackWrapperLabelsCannedTextAndKeepsTheReason() {
        AIProvider provider = new AIConfig().aiProvider(props("canned", true), new AiStatusTracker());
        AIResult r = provider.generateResult("monthly report please", "gemini-2.5-flash");
        assertFalse(r.live());
        assertEquals(CannedFallbackProvider.PROVIDER_NAME, r.provider());
        assertEquals("none", r.model());
        assertNotNull(r.failure());
        assertTrue(r.text().contains("Offline guidance"));
    }

    @Test
    void wrapperReportsTheLiveModelFailureKind() {
        AIProvider failing = new AIProvider() {
            @Override public String generate(String p, String m) { throw new AIProviderException(AIFailureKind.MODEL_NOT_FOUND, m, "404", null); }
            @Override public String providerName() { return "gemini"; }
        };
        AIProvider wrapped = AIConfig.withCannedFallback(failing);
        AIResult r = wrapped.generateResult("hi", "gemini-2.0-flash");
        assertEquals(CannedFallbackProvider.PROVIDER_NAME, r.provider());
        assertThrows(AIProviderException.class, () -> wrapped.generateLive("hi", "gemini-2.0-flash"));
        assertEquals(AIFailureKind.MODEL_NOT_FOUND, r.failure());
        assertFalse(r.live());
    }

    @Test
    void liveOnlyPathNeverReturnsCannedText() {
        AIProvider provider = new AIConfig().aiProvider(props("canned", true), new AiStatusTracker());
        assertThrows(IllegalStateException.class, () -> provider.generateLive("hello", "gemini-2.5-flash"));
    }

    @Test
    void cannedTextsMakeNoClaimsAboutTheUserAndContainNoNumbers() {
        CannedFallbackProvider canned = new CannedFallbackProvider();
        Pattern number = Pattern.compile("\\d");
        Pattern userClaim = Pattern.compile("(?i)you primarily|your (footprint|usage) (decreased|increased|is moderate)|you tracked|great month");
        for (String prompt : new String[]{"reduction recommend", "electricity kWh", "transport travel", "scenario", "persuasive",
                "leaderboard", "tip", "monthly report", "anything else"}) {
            String text = canned.generate(prompt, "m");
            assertFalse(userClaim.matcher(text).find(), prompt + " -> " + text);
            assertFalse(number.matcher(text.replace("null", "")).find(), prompt + " -> " + text);
        }
    }

    @Test
    void globalLocationUsesTheGlobalHost() {
        assertEquals("aiplatform.googleapis.com", VertexClients.host("global"));
        assertEquals("asia-south1-aiplatform.googleapis.com", VertexClients.host("asia-south1"));
    }

    @Test
    void statusTrackerExposesFailureKindsInHealth() {
        AiStatusTracker t = new AiStatusTracker();
        t.recordFailure("gemini-2.0-flash", AIFailureKind.MODEL_NOT_FOUND);
        t.recordSuccess("gemini-2.5-flash");
        assertEquals("MODEL_NOT_FOUND", t.snapshot().get("gemini-2.0-flash").lastOutcome());
        assertEquals("OK", t.snapshot().get("gemini-2.5-flash").lastOutcome());
        assertEquals("UP", t.health().getStatus().getCode());
    }
}
