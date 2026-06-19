package com.ecotrack.ai;

import com.ecotrack.config.AppProperties;
import com.google.cloud.vertexai.VertexAI;
import com.google.cloud.vertexai.api.GenerateContentResponse;
import com.google.cloud.vertexai.generativeai.GenerativeModel;
import com.google.cloud.vertexai.generativeai.ResponseHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Google Gemini AI provider via Vertex AI SDK. Uses Application Default
 * Credentials (GOOGLE_APPLICATION_CREDENTIALS). Supports gemini-2.5-pro
 * (quality) and gemini-2.0-flash (fast).
 */
public class GeminiAIProvider implements AIProvider {

    private static final Logger log = LoggerFactory.getLogger(GeminiAIProvider.class);

    private final String projectId;
    private final String location;

    public GeminiAIProvider(AppProperties props) {
        this.projectId = props.ai().gemini().projectId();
        this.location = props.ai().gemini().location();
        log.info("GeminiAIProvider initialized — project={}, location={}", projectId, location);
    }

    @Override
    public String generate(String prompt, String model) {
        try (VertexAI vertexAI = new VertexAI(projectId, location)) {
            GenerativeModel generativeModel = new GenerativeModel(model, vertexAI);
            GenerateContentResponse response = generativeModel.generateContent(prompt);
            String text = ResponseHandler.getText(response);
            log.debug("Gemini response from model={}: {} chars", model, text.length());
            return text;
        } catch (Exception e) {
            log.error("Gemini API call failed — model={}", model, e);
            throw new RuntimeException("AI generation failed: " + e.getMessage(), e);
        }
    }

    @Override
    public String providerName() {
        return "gemini";
    }
}
