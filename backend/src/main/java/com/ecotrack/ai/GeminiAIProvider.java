package com.ecotrack.ai;

import com.ecotrack.config.AppProperties;
import com.google.cloud.vertexai.VertexAI;
import com.google.cloud.vertexai.api.Candidate;
import com.google.cloud.vertexai.api.GenerateContentResponse;
import com.google.cloud.vertexai.generativeai.GenerativeModel;
import com.google.cloud.vertexai.generativeai.ResponseHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Google Gemini via the Vertex AI SDK, using Application Default Credentials (no API key).
 * Failures are classified ({@link AIFailureKind}) and thrown as {@link AIProviderException};
 * this class never substitutes text. Prompts are never logged.
 */
public class GeminiAIProvider implements AIProvider, AutoCloseable {

    private static final Logger log = LoggerFactory.getLogger(GeminiAIProvider.class);

    private final String projectId;
    private final String location;
    private final AiStatusTracker status;
    /** Shared client: one gRPC channel for all calls instead of a new channel + TLS handshake per call. */
    private volatile VertexAI vertexAI;

    public GeminiAIProvider(AppProperties props) {
        this(props, new AiStatusTracker());
    }

    public GeminiAIProvider(AppProperties props, AiStatusTracker status) {
        this.projectId = props.ai().gemini().projectId();
        this.location = props.ai().gemini().location();
        this.status = status;
        log.info("GeminiAIProvider initialized — project={}, location={}, host={}", projectId, location, VertexClients.host(location));
    }

    /** Created on first use so a missing project id fails the call (classified), not application startup. */
    private VertexAI vertexAI() {
        VertexAI v = vertexAI;
        if (v == null) {
            synchronized (this) {
                if (vertexAI == null) vertexAI = VertexClients.create(projectId, location);
                v = vertexAI;
            }
        }
        return v;
    }

    @Override
    public void close() {
        if (vertexAI != null) vertexAI.close();
    }

    @Override
    public String generate(String prompt, String model) {
        return generateResult(prompt, model).text();
    }

    @Override
    public AIResult generateResult(String prompt, String model) {
        long t0 = System.nanoTime();
        try {
            GenerateContentResponse response = new GenerativeModel(model, vertexAI()).generateContent(prompt);
            if (response.getCandidatesCount() == 0
                    || response.getCandidates(0).getFinishReason() == Candidate.FinishReason.SAFETY) {
                throw new AIProviderException(AIFailureKind.BLOCKED, model, "no candidate text", null);
            }
            String text = ResponseHandler.getText(response);
            if (text == null || text.isBlank()) {
                throw new AIProviderException(AIFailureKind.EMPTY_RESPONSE, model, "empty text", null);
            }
            long ms = (System.nanoTime() - t0) / 1_000_000;
            var usage = response.getUsageMetadata();
            status.recordSuccess(model);
            return AIResult.live(text, providerName(), model, usage.getPromptTokenCount(),
                    usage.getTotalTokenCount() - usage.getPromptTokenCount(), ms);
        } catch (AIProviderException e) {
            status.recordFailure(model, e.kind());
            log.warn("Gemini call failed kind={} model={} location={}", e.kind(), model, location);
            throw e;
        } catch (Exception e) {
            AIFailureKind kind = AIFailureKind.classify(e);
            status.recordFailure(model, kind);
            log.warn("Gemini call failed kind={} model={} location={}: {}", kind, model, location, e.getClass().getSimpleName());
            throw new AIProviderException(kind, model, e.getClass().getSimpleName(), e);
        }
    }

    @Override
    public String providerName() {
        return "gemini";
    }

    public String location() { return location; }

    public String projectId() { return projectId; }
}
