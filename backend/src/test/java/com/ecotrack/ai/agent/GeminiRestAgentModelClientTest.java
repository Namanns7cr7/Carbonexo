package com.ecotrack.ai.agent;

import com.ecotrack.ai.AIFailureKind;
import com.ecotrack.ai.AIProviderException;
import com.ecotrack.ai.agent.AgentModelClient.FunctionCall;
import com.ecotrack.ai.agent.AgentModelClient.FunctionResult;
import com.ecotrack.ai.agent.AgentModelClient.Message;
import com.ecotrack.ai.agent.AgentModelClient.Request;
import com.ecotrack.ai.agent.AgentModelClient.Response;
import com.ecotrack.ai.agent.AgentModelClient.ToolSpec;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class GeminiRestAgentModelClientTest {

    static final ObjectMapper JSON = new ObjectMapper();
    final GeminiRestAgentModelClient global = new GeminiRestAgentModelClient("carbonexo", "global", null, null, () -> "t");

    @Test
    void globalAndRegionalEndpoints() {
        assertEquals("https://aiplatform.googleapis.com/v1/projects/carbonexo/locations/global/publishers/google/models/gemini-3-flash-preview:generateContent",
                global.endpoint("gemini-3-flash-preview"));
        assertTrue(new GeminiRestAgentModelClient("carbonexo", "asia-south1", null, null, () -> "t").endpoint("gemini-2.5-flash")
                .startsWith("https://asia-south1-aiplatform.googleapis.com/v1/projects/carbonexo/locations/asia-south1/"));
    }

    @Test
    void thoughtSignatureIsParsedAndSentBackOnTheSamePart() throws Exception {
        JsonNode reply = JSON.readTree("""
                {"candidates":[{"content":{"role":"model","parts":[
                  {"text":"internal reasoning","thought":true},
                  {"functionCall":{"name":"getGreenCreditBalance","args":{}},"thoughtSignature":"c2lnLTE="},
                  {"functionCall":{"name":"getCarbonCreditScore","args":{}}}]},"finishReason":"STOP"}],
                 "usageMetadata":{"promptTokenCount":120,"candidatesTokenCount":10,"thoughtsTokenCount":30}}""");
        Response r = GeminiRestAgentModelClient.parse("gemini-3-flash-preview", reply);
        assertEquals("", r.text(), "thought text must never become the answer");
        assertEquals(2, r.calls().size());
        assertEquals("c2lnLTE=", r.calls().get(0).thoughtSignature());
        assertNull(r.calls().get(1).thoughtSignature());
        assertEquals(40, r.outputTokens());

        Request next = new Request("gemini-3-flash-preview", "sys", List.of(Message.user("How many green credits do I have?"),
                Message.model("", r.calls()),
                Message.tools(List.of(new FunctionResult("getGreenCreditBalance", Map.of("status", "OK", "balance", 100)),
                        new FunctionResult("getCarbonCreditScore", Map.of("status", "OK", "score", 350))))),
                List.of(new ToolSpec("getGreenCreditBalance", "d", "{\"type\":\"OBJECT\",\"properties\":{}}")), 512, Duration.ofSeconds(5));
        JsonNode body = global.body(next);
        JsonNode modelParts = body.path("contents").path(1).path("parts");
        assertEquals("model", body.path("contents").path(1).path("role").asText());
        assertEquals("c2lnLTE=", modelParts.path(0).path("thoughtSignature").asText());
        assertEquals("getGreenCreditBalance", modelParts.path(0).path("functionCall").path("name").asText());
        assertFalse(modelParts.path(1).has("thoughtSignature"));
        JsonNode toolParts = body.path("contents").path(2).path("parts");
        assertEquals(100, toolParts.path(0).path("functionResponse").path("response").path("balance").asInt());
        assertEquals("low", body.path("generationConfig").path("thinkingConfig").path("thinkingLevel").asText());
        assertFalse(body.path("generationConfig").has("temperature"));
    }

    @Test
    void forcedToolsUseModeAnyAndGemini25KeepsLowTemperature() throws Exception {
        Request req = new Request("gemini-2.5-flash", "sys", List.of(Message.user("hi")),
                List.of(new ToolSpec("getCarbonCreditScore", "d", "{\"type\":\"OBJECT\",\"properties\":{}}")), 256, Duration.ofSeconds(5),
                List.of("getCarbonCreditScore"));
        JsonNode body = global.body(req);
        assertEquals("ANY", body.path("toolConfig").path("functionCallingConfig").path("mode").asText());
        assertEquals("getCarbonCreditScore", body.path("toolConfig").path("functionCallingConfig").path("allowedFunctionNames").path(0).asText());
        assertEquals(0.2, body.path("generationConfig").path("temperature").asDouble(), 1e-9);
        assertFalse(body.path("generationConfig").has("thinkingConfig"));
        assertEquals("sys", body.path("systemInstruction").path("parts").path(0).path("text").asText());
    }

    @Test
    void emptyAndBlockedRepliesAreClassifiedNotReturned() throws Exception {
        var e = assertThrows(AIProviderException.class, () -> GeminiRestAgentModelClient.parse("m",
                JSON.readTree("{\"candidates\":[{\"content\":{\"parts\":[]},\"finishReason\":\"SAFETY\"}]}")));
        assertEquals(AIFailureKind.BLOCKED, e.kind());
        e = assertThrows(AIProviderException.class, () -> GeminiRestAgentModelClient.parse("m", JSON.readTree("{}")));
        assertEquals(AIFailureKind.BLOCKED, e.kind());
        assertEquals(AIFailureKind.INVALID_REQUEST, GeminiRestAgentModelClient.kindForStatus(400, ""));
        assertEquals(AIFailureKind.MODEL_NOT_FOUND, GeminiRestAgentModelClient.kindForStatus(404, ""));
        assertEquals(AIFailureKind.QUOTA, GeminiRestAgentModelClient.kindForStatus(429, ""));
        assertEquals(AIFailureKind.UNAVAILABLE, GeminiRestAgentModelClient.kindForStatus(503, ""));
        assertEquals(AIFailureKind.AUTH, GeminiRestAgentModelClient.kindForStatus(403, ""));
    }

    @Test
    void legacyTwoArgumentFunctionCallHasNoSignature() {
        assertNull(new FunctionCall("x", Map.of()).thoughtSignature());
    }
}
