package com.ecotrack.ai.memory;

import com.google.cloud.vertexai.api.PredictRequest;
import com.google.cloud.vertexai.api.PredictResponse;
import com.google.cloud.vertexai.api.PredictionServiceClient;
import com.google.cloud.vertexai.api.PredictionServiceSettings;
import com.google.protobuf.Struct;
import com.google.protobuf.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Vertex AI text embeddings (default {@code text-embedding-005}, 768 dims) via the
 * {@code publishers/google/models/{model}:predict} endpoint, using Application
 * Default Credentials. Each call is bounded by a timeout so a slow embedding
 * service degrades the coach to its non-vector workflow instead of stalling it.
 */
public class VertexEmbeddingProvider implements EmbeddingProvider, AutoCloseable {

    private static final Logger log = LoggerFactory.getLogger(VertexEmbeddingProvider.class);

    /** Seam over the gRPC client so tests need no network or credentials. */
    interface PredictCall {
        PredictResponse call(PredictRequest request, long timeoutMs) throws Exception;
    }

    private final PredictCall predictCall;
    private final AutoCloseable resource;
    private final String endpoint;
    private final String model;
    private final int dimensions;
    private final long timeoutMs;

    public VertexEmbeddingProvider(String projectId, String location, String model,
                                   int dimensions, long timeoutMs) throws IOException {
        this(createClient(location), projectId, location, model, dimensions, timeoutMs);
    }

    private VertexEmbeddingProvider(PredictionServiceClient client, String projectId, String location,
                                    String model, int dimensions, long timeoutMs) {
        this((req, t) -> client.predictCallable().futureCall(req).get(t, TimeUnit.MILLISECONDS),
                client, projectId, location, model, dimensions, timeoutMs);
    }

    VertexEmbeddingProvider(PredictCall predictCall, AutoCloseable resource, String projectId,
                            String location, String model, int dimensions, long timeoutMs) {
        if (projectId == null || projectId.isBlank()) {
            throw new IllegalArgumentException("GCP project id is required for Vertex AI embeddings");
        }
        this.predictCall = predictCall;
        this.resource = resource;
        this.endpoint = "projects/%s/locations/%s/publishers/google/models/%s".formatted(projectId, location, model);
        this.model = model;
        this.dimensions = dimensions;
        this.timeoutMs = timeoutMs;
        log.info("VertexEmbeddingProvider initialized — model={}, dims={}, location={}", model, dimensions, location);
    }

    private static PredictionServiceClient createClient(String location) throws IOException {
        return PredictionServiceClient.create(PredictionServiceSettings.newBuilder()
                .setEndpoint(location + "-aiplatform.googleapis.com:443")
                .build());
    }

    @Override
    public float[] embed(String text, Task task) {
        if (text == null || text.isBlank()) {
            throw new EmbeddingException("Cannot embed blank text");
        }
        PredictRequest request = PredictRequest.newBuilder()
                .setEndpoint(endpoint)
                .addInstances(struct(Struct.newBuilder()
                        .putFields("content", Value.newBuilder().setStringValue(text).build())
                        .putFields("task_type", Value.newBuilder().setStringValue(task.name()).build())))
                .setParameters(struct(Struct.newBuilder()
                        .putFields("autoTruncate", Value.newBuilder().setBoolValue(true).build())
                        .putFields("outputDimensionality", Value.newBuilder().setNumberValue(dimensions).build())))
                .build();

        PredictResponse response;
        try {
            response = predictCall.call(request, timeoutMs);
        } catch (TimeoutException e) {
            throw new EmbeddingException("Embedding timed out after " + timeoutMs + " ms", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new EmbeddingException("Embedding interrupted", e);
        } catch (Exception e) {
            throw new EmbeddingException("Embedding call failed: " + e.getMessage(), e);
        }
        return parse(response);
    }

    private float[] parse(PredictResponse response) {
        if (response == null || response.getPredictionsCount() == 0) {
            throw new EmbeddingException("Embedding response had no predictions");
        }
        List<Value> values = response.getPredictions(0).getStructValue()
                .getFieldsOrDefault("embeddings", Value.getDefaultInstance()).getStructValue()
                .getFieldsOrDefault("values", Value.getDefaultInstance()).getListValue()
                .getValuesList();
        if (values.size() != dimensions) {
            throw new EmbeddingException("Embedding dimension mismatch: model " + model
                    + " returned " + values.size() + ", expected " + dimensions);
        }
        float[] out = new float[dimensions];
        for (int i = 0; i < dimensions; i++) {
            out[i] = (float) values.get(i).getNumberValue();
        }
        return out;
    }

    private static Value struct(Struct.Builder builder) {
        return Value.newBuilder().setStructValue(builder).build();
    }

    @Override
    public String modelName() {
        return model;
    }

    @Override
    public int dimensions() {
        return dimensions;
    }

    @Override
    public void close() throws Exception {
        if (resource != null) {
            resource.close();
        }
    }
}
