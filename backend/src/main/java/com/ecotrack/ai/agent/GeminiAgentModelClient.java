package com.ecotrack.ai.agent;

import com.ecotrack.ai.AIFailureKind;
import com.ecotrack.ai.AIProviderException;
import com.ecotrack.ai.AiStatusTracker;
import com.ecotrack.ai.VertexClients;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.cloud.vertexai.VertexAI;
import com.google.cloud.vertexai.api.Candidate;
import com.google.cloud.vertexai.api.Content;
import com.google.cloud.vertexai.api.FunctionCallingConfig;
import com.google.cloud.vertexai.api.FunctionDeclaration;
import com.google.cloud.vertexai.api.GenerateContentResponse;
import com.google.cloud.vertexai.api.GenerationConfig;
import com.google.cloud.vertexai.api.Part;
import com.google.cloud.vertexai.api.Tool;
import com.google.cloud.vertexai.api.ToolConfig;
import com.google.cloud.vertexai.generativeai.ContentMaker;
import com.google.cloud.vertexai.generativeai.FunctionDeclarationMaker;
import com.google.cloud.vertexai.generativeai.GenerativeModel;
import com.google.cloud.vertexai.generativeai.PartMaker;
import com.google.protobuf.Struct;
import com.google.protobuf.util.JsonFormat;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/** Gemini function calling via the Vertex AI SDK (ADC credentials; global endpoint supported). */
public class GeminiAgentModelClient implements AgentModelClient {

    private static final Logger log = LoggerFactory.getLogger(GeminiAgentModelClient.class);
    private static final ObjectMapper JSON = new ObjectMapper();

    private final String projectId;
    private final String location;
    private final AiStatusTracker status;

    public GeminiAgentModelClient(String projectId, String location, AiStatusTracker status) {
        this.projectId = projectId;
        this.location = location;
        this.status = status;
    }

    @Override
    public Response generate(Request req) {
        long started = System.nanoTime();
        try {
            return attempt(req);
        } catch (AIProviderException e) {
            boolean transientKind = e.kind() == AIFailureKind.QUOTA || e.kind() == AIFailureKind.UNAVAILABLE
                    || e.kind() == AIFailureKind.EMPTY_RESPONSE;
            long leftMs = req.timeout().toMillis() - (System.nanoTime() - started) / 1_000_000 - 1500;
            if (!transientKind || leftMs < 3000) throw e;
            log.info("Gemini agent call {}: retrying once", e.kind());
            try {
                Thread.sleep(1500);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw e;
            }
            return attempt(new Request(req.model(), req.systemInstruction(), req.messages(), req.tools(), req.maxOutputTokens(),
                    java.time.Duration.ofMillis(leftMs), req.forceTools()));
        }
    }

    private Response attempt(Request req) {
        CompletableFuture<Response> f = CompletableFuture.supplyAsync(() -> call(req));
        try {
            return f.get(req.timeout().toMillis(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            f.cancel(true);
            status.recordFailure(req.model(), AIFailureKind.TIMEOUT);
            throw new AIProviderException(AIFailureKind.TIMEOUT, req.model(), "model call exceeded " + req.timeout(), e);
        } catch (ExecutionException e) {
            Throwable c = e.getCause();
            if (c instanceof AIProviderException ape) throw ape;
            AIFailureKind kind = AIFailureKind.classify(c);
            status.recordFailure(req.model(), kind);
            throw new AIProviderException(kind, req.model(), c.getClass().getSimpleName(), c);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AIProviderException(AIFailureKind.TIMEOUT, req.model(), "interrupted", e);
        }
    }

    private Response call(Request req) {
        try (VertexAI vertex = VertexClients.create(projectId, location)) {
            GenerativeModel model = new GenerativeModel(req.model(), vertex)
                    .withSystemInstruction(ContentMaker.fromString(req.systemInstruction()))
                    .withGenerationConfig(GenerationConfig.newBuilder()
                            .setTemperature(0.2f).setMaxOutputTokens(req.maxOutputTokens()).build());
            if (!req.tools().isEmpty()) {
                List<FunctionDeclaration> decls = new ArrayList<>();
                for (ToolSpec t : req.tools()) {
                    String json = "{\"name\":" + JSON.writeValueAsString(t.name()) + ",\"description\":"
                            + JSON.writeValueAsString(t.description()) + ",\"parameters\":" + t.parametersJson() + "}";
                    decls.add(FunctionDeclarationMaker.fromJsonString(json));
                }
                model = model.withTools(List.of(Tool.newBuilder().addAllFunctionDeclarations(decls).build()));
                if (req.forceTools() != null && !req.forceTools().isEmpty()) {
                    model = model.withToolConfig(ToolConfig.newBuilder().setFunctionCallingConfig(FunctionCallingConfig.newBuilder()
                            .setMode(FunctionCallingConfig.Mode.ANY).addAllAllowedFunctionNames(req.forceTools())).build());
                }
            }
            GenerateContentResponse resp = model.generateContent(toContents(req.messages()));
            if (resp.getCandidatesCount() == 0) {
                throw new AIProviderException(AIFailureKind.BLOCKED, req.model(), "no candidates", null);
            }
            Candidate cand = resp.getCandidates(0);
            StringBuilder text = new StringBuilder();
            List<FunctionCall> calls = new ArrayList<>();
            for (Part p : cand.getContent().getPartsList()) {
                if (p.hasFunctionCall()) {
                    calls.add(new FunctionCall(p.getFunctionCall().getName(), structToMap(p.getFunctionCall().getArgs())));
                } else if (!p.getText().isEmpty()) {
                    text.append(p.getText());
                }
            }
            if (calls.isEmpty() && text.isEmpty()) {
                throw new AIProviderException(cand.getFinishReason() == Candidate.FinishReason.SAFETY
                        ? AIFailureKind.BLOCKED : AIFailureKind.EMPTY_RESPONSE, req.model(), String.valueOf(cand.getFinishReason()), null);
            }
            var usage = resp.getUsageMetadata();
            status.recordSuccess(req.model());
            return new Response(text.toString(), calls, usage.getPromptTokenCount(),
                    usage.getTotalTokenCount() - usage.getPromptTokenCount(), String.valueOf(cand.getFinishReason()));
        } catch (AIProviderException e) {
            status.recordFailure(req.model(), e.kind());
            throw e;
        } catch (Exception e) {
            AIFailureKind kind = AIFailureKind.classify(e);
            status.recordFailure(req.model(), kind);
            log.warn("Gemini agent call failed kind={} model={} location={}", kind, req.model(), location);
            throw new AIProviderException(kind, req.model(), e.getClass().getSimpleName(), e);
        }
    }

    private static List<Content> toContents(List<Message> messages) throws Exception {
        List<Content> out = new ArrayList<>();
        for (Message m : messages) {
            Content.Builder c = Content.newBuilder();
            switch (m.role()) {
                case USER -> c.setRole("user").addParts(Part.newBuilder().setText(m.text()));
                case MODEL -> {
                    c.setRole("model");
                    if (m.text() != null && !m.text().isBlank()) c.addParts(Part.newBuilder().setText(m.text()));
                    for (FunctionCall fc : m.calls()) {
                        c.addParts(Part.newBuilder().setFunctionCall(com.google.cloud.vertexai.api.FunctionCall.newBuilder()
                                .setName(fc.name()).setArgs(mapToStruct(fc.args()))));
                    }
                }
                case TOOL -> {
                    c.setRole("user");
                    for (FunctionResult r : m.results()) {
                        c.addParts(PartMaker.fromFunctionResponse(r.name(), mapToStruct(r.response())));
                    }
                }
            }
            out.add(c.build());
        }
        return out;
    }

    static Struct mapToStruct(Map<String, Object> map) throws Exception {
        Struct.Builder b = Struct.newBuilder();
        JsonFormat.parser().merge(JSON.writeValueAsString(map == null ? Map.of() : map), b);
        return b.build();
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> structToMap(Struct s) throws Exception {
        return JSON.readValue(JsonFormat.printer().print(s), Map.class);
    }

    @Override
    public String providerName() {
        return "gemini";
    }
}
