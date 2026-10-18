package com.ecotrack.ai.agent;

import com.ecotrack.ai.AIFailureKind;
import com.ecotrack.ai.AIProviderException;
import com.ecotrack.ai.AiStatusTracker;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.auth.oauth2.GoogleCredentials;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Gemini function calling over the Vertex AI REST API ({@code generateContent}).
 *
 * <p>Exists for Gemini 3: it returns a {@code thoughtSignature} on function-call parts and rejects the
 * next turn (400 INVALID_ARGUMENT) unless each signature is sent back unchanged on the same part. The
 * Vertex Java SDK this project uses (1.12.0) has no field for it, so {@link GeminiAgentModelClient}
 * cannot carry it. This client keeps the signature on {@link FunctionCall#thoughtSignature()}.
 *
 * <p>One shared HTTP client (connection reuse), ADC credentials refreshed only when expired, the
 * same timeout/retry/failure classification as the SDK client, and low thinking for Gemini 3.
 */
public class GeminiRestAgentModelClient implements AgentModelClient {

    private static final Logger log = LoggerFactory.getLogger(GeminiRestAgentModelClient.class);
    private static final ObjectMapper JSON = new ObjectMapper();

    private final String projectId;
    private final String location;
    private final AiStatusTracker status;
    private final HttpClient http;
    private final Supplier<String> token;

    public GeminiRestAgentModelClient(String projectId, String location, AiStatusTracker status) {
        this(projectId, location, status, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build(), adcToken());
    }

    GeminiRestAgentModelClient(String projectId, String location, AiStatusTracker status, HttpClient http, Supplier<String> token) {
        this.projectId = projectId;
        this.location = location;
        this.status = status;
        this.http = http;
        this.token = token;
    }

    private static Supplier<String> adcToken() {
        return new Supplier<>() {
            private GoogleCredentials creds;

            @Override
            public synchronized String get() {
                try {
                    if (creds == null) creds = GoogleCredentials.getApplicationDefault().createScoped("https://www.googleapis.com/auth/cloud-platform");
                    creds.refreshIfExpired();
                    return creds.getAccessToken().getTokenValue();
                } catch (IOException e) {
                    throw new AIProviderException(AIFailureKind.AUTH, "-", "no application default credentials", e);
                }
            }
        };
    }

    String endpoint(String model) {
        String host = "global".equals(location) ? "aiplatform.googleapis.com" : location + "-aiplatform.googleapis.com";
        return "https://" + host + "/v1/projects/" + projectId + "/locations/" + location + "/publishers/google/models/" + model + ":generateContent";
    }

    @Override
    public Response generate(Request req) {
        long started = System.nanoTime();
        try {
            return attempt(req, req.timeout());
        } catch (AIProviderException e) {
            boolean transientKind = e.kind() == AIFailureKind.QUOTA || e.kind() == AIFailureKind.UNAVAILABLE
                    || e.kind() == AIFailureKind.EMPTY_RESPONSE;
            long leftMs = req.timeout().toMillis() - (System.nanoTime() - started) / 1_000_000 - 1500;
            if (!transientKind || leftMs < 3000) throw e;
            log.info("Gemini REST agent call {}: retrying once", e.kind());
            try {
                Thread.sleep(1500);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw e;
            }
            return attempt(req, Duration.ofMillis(leftMs));
        }
    }

    private Response attempt(Request req, Duration timeout) {
        try {
            HttpRequest httpReq = HttpRequest.newBuilder(URI.create(endpoint(req.model())))
                    .timeout(timeout)
                    .header("Authorization", "Bearer " + token.get())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body(req))))
                    .build();
            HttpResponse<String> resp = http.send(httpReq, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() / 100 != 2) {
                AIFailureKind kind = kindForStatus(resp.statusCode(), resp.body());
                log.warn("Gemini REST agent call failed kind={} http={} model={} location={}", kind, resp.statusCode(), req.model(), location);
                throw new AIProviderException(kind, req.model(), "HTTP " + resp.statusCode(), null);
            }
            Response out = parse(req.model(), JSON.readTree(resp.body()));
            status.recordSuccess(req.model());
            return out;
        } catch (AIProviderException e) {
            status.recordFailure(req.model(), e.kind());
            throw e;
        } catch (HttpTimeoutException e) {
            status.recordFailure(req.model(), AIFailureKind.TIMEOUT);
            throw new AIProviderException(AIFailureKind.TIMEOUT, req.model(), "model call exceeded " + timeout, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            status.recordFailure(req.model(), AIFailureKind.TIMEOUT);
            throw new AIProviderException(AIFailureKind.TIMEOUT, req.model(), "interrupted", e);
        } catch (IOException e) {
            AIFailureKind kind = AIFailureKind.classify(e);
            AIFailureKind k = kind == AIFailureKind.UNKNOWN ? AIFailureKind.NETWORK : kind;
            status.recordFailure(req.model(), k);
            throw new AIProviderException(k, req.model(), e.getClass().getSimpleName(), e);
        }
    }

    static AIFailureKind kindForStatus(int code, String body) {
        return switch (code) {
            case 400 -> AIFailureKind.INVALID_REQUEST;
            case 401, 403 -> AIFailureKind.AUTH;
            case 404 -> AIFailureKind.MODEL_NOT_FOUND;
            case 408, 504 -> AIFailureKind.TIMEOUT;
            case 429 -> AIFailureKind.QUOTA;
            default -> code >= 500 ? AIFailureKind.UNAVAILABLE : AIFailureKind.UNKNOWN;
        };
    }

    static boolean isGemini3(String model) {
        return model != null && model.startsWith("gemini-3");
    }

    ObjectNode body(Request req) throws IOException {
        ObjectNode b = JSON.createObjectNode();
        b.putObject("systemInstruction").putArray("parts").addObject().put("text", req.systemInstruction());
        ArrayNode contents = b.putArray("contents");
        for (Message m : req.messages()) {
            ObjectNode c = contents.addObject();
            ArrayNode parts = c.putArray("parts");
            switch (m.role()) {
                case USER -> {
                    c.put("role", "user");
                    parts.addObject().put("text", m.text());
                }
                case MODEL -> {
                    c.put("role", "model");
                    if (m.text() != null && !m.text().isBlank()) parts.addObject().put("text", m.text());
                    for (FunctionCall fc : m.calls()) {
                        ObjectNode p = parts.addObject();
                        ObjectNode call = p.putObject("functionCall");
                        call.put("name", fc.name());
                        call.set("args", JSON.valueToTree(fc.args() == null ? Map.of() : fc.args()));
                        // Gemini 3 validates this: the exact signature it returned, on the same part.
                        if (fc.thoughtSignature() != null) p.put("thoughtSignature", fc.thoughtSignature());
                    }
                }
                case TOOL -> {
                    c.put("role", "user");
                    for (FunctionResult r : m.results()) {
                        ObjectNode fr = parts.addObject().putObject("functionResponse");
                        fr.put("name", r.name());
                        fr.set("response", JSON.valueToTree(r.response() == null ? Map.of() : r.response()));
                    }
                }
            }
        }
        if (!req.tools().isEmpty()) {
            ArrayNode decls = b.putArray("tools").addObject().putArray("functionDeclarations");
            for (ToolSpec t : req.tools()) {
                ObjectNode d = decls.addObject();
                d.put("name", t.name());
                d.put("description", t.description());
                d.set("parameters", JSON.readTree(t.parametersJson()));
            }
            if (req.forceTools() != null && !req.forceTools().isEmpty()) {
                ObjectNode fcc = b.putObject("toolConfig").putObject("functionCallingConfig");
                fcc.put("mode", "ANY");
                ArrayNode allowed = fcc.putArray("allowedFunctionNames");
                req.forceTools().forEach(allowed::add);
            }
        }
        ObjectNode gen = b.putObject("generationConfig");
        gen.put("maxOutputTokens", req.maxOutputTokens());
        if (isGemini3(req.model())) {
            // Google's guidance for Gemini 3: keep the default temperature (1.0); lower values can loop.
            gen.putObject("thinkingConfig").put("thinkingLevel", "low");
        } else {
            gen.put("temperature", 0.2);
        }
        return b;
    }

    static Response parse(String model, JsonNode root) {
        JsonNode cand = root.path("candidates").path(0);
        if (cand.isMissingNode()) {
            throw new AIProviderException(AIFailureKind.BLOCKED, model, "no candidates", null);
        }
        StringBuilder text = new StringBuilder();
        List<FunctionCall> calls = new ArrayList<>();
        for (JsonNode p : cand.path("content").path("parts")) {
            if (p.has("functionCall")) {
                JsonNode fc = p.get("functionCall");
                @SuppressWarnings("unchecked")
                Map<String, Object> args = fc.has("args") ? JSON.convertValue(fc.get("args"), Map.class) : Map.of();
                String sig = p.hasNonNull("thoughtSignature") ? p.get("thoughtSignature").asText() : null;
                calls.add(new FunctionCall(fc.path("name").asText(), args, sig));
            } else if (p.has("text") && !p.path("thought").asBoolean(false)) {
                text.append(p.get("text").asText());
            }
        }
        String finish = cand.path("finishReason").asText("UNSPECIFIED");
        if (calls.isEmpty() && text.isEmpty()) {
            throw new AIProviderException("SAFETY".equals(finish) ? AIFailureKind.BLOCKED : AIFailureKind.EMPTY_RESPONSE, model, finish, null);
        }
        JsonNode usage = root.path("usageMetadata");
        int in = usage.path("promptTokenCount").asInt(0);
        int out = usage.path("candidatesTokenCount").asInt(0) + usage.path("thoughtsTokenCount").asInt(0);
        return new Response(text.toString(), calls, in, out, finish);
    }

    @Override
    public String providerName() {
        return "gemini";
    }
}
