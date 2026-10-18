package com.ecotrack.ai;

import com.google.cloud.vertexai.VertexAI;

/**
 * Builds Vertex AI clients. The SDK derives the host as "{location}-aiplatform.googleapis.com",
 * which does not exist for location "global" (Gemini 3 preview models are only served there), so
 * the global host is set explicitly. Verified 2026-10-17: without this, calls fail UNIMPLEMENTED/404.
 */
public final class VertexClients {

    static final String GLOBAL_HOST = "aiplatform.googleapis.com";

    private VertexClients() {}

    public static VertexAI create(String projectId, String location) {
        VertexAI.Builder b = new VertexAI.Builder().setProjectId(projectId).setLocation(location);
        if ("global".equalsIgnoreCase(location)) {
            b.setApiEndpoint(GLOBAL_HOST);
        }
        return b.build();
    }

    /** Host the SDK will call; exposed for startup logging and tests. */
    public static String host(String location) {
        return "global".equalsIgnoreCase(location) ? GLOBAL_HOST : location + "-aiplatform.googleapis.com";
    }
}
