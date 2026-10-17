package com.ecotrack.ai.memory;

import com.google.cloud.vertexai.api.PredictRequest;
import com.google.cloud.vertexai.api.PredictResponse;
import com.google.protobuf.ListValue;
import com.google.protobuf.Struct;
import com.google.protobuf.Value;
import org.junit.jupiter.api.Test;

import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class VertexEmbeddingProviderTest {

    private static PredictResponse responseWith(int dims) {
        ListValue.Builder values = ListValue.newBuilder();
        for (int i = 0; i < dims; i++) {
            values.addValues(Value.newBuilder().setNumberValue(i / 1000.0));
        }
        Struct embeddings = Struct.newBuilder()
                .putFields("values", Value.newBuilder().setListValue(values).build()).build();
        Struct prediction = Struct.newBuilder()
                .putFields("embeddings", Value.newBuilder().setStructValue(embeddings).build()).build();
        return PredictResponse.newBuilder().addPredictions(Value.newBuilder().setStructValue(prediction)).build();
    }

    private static VertexEmbeddingProvider provider(VertexEmbeddingProvider.PredictCall call) {
        return new VertexEmbeddingProvider(call, null, "carbonexo", "us-central1", "text-embedding-005", 768, 1500);
    }

    @Test
    void embedsAndSendsTaskTypeEndpointAndDimensionality() {
        AtomicReference<PredictRequest> sent = new AtomicReference<>();
        AtomicReference<Long> timeout = new AtomicReference<>();
        var provider = provider((req, t) -> { sent.set(req); timeout.set(t); return responseWith(768); });

        float[] v = provider.embed("I cycle to work now", EmbeddingProvider.Task.RETRIEVAL_QUERY);

        assertEquals(768, v.length);
        assertEquals(0.001f, v[1], 1e-6);
        PredictRequest req = sent.get();
        assertEquals("projects/carbonexo/locations/us-central1/publishers/google/models/text-embedding-005",
                req.getEndpoint());
        Struct instance = req.getInstances(0).getStructValue();
        assertEquals("I cycle to work now", instance.getFieldsOrThrow("content").getStringValue());
        assertEquals("RETRIEVAL_QUERY", instance.getFieldsOrThrow("task_type").getStringValue());
        assertEquals(768, req.getParameters().getStructValue()
                .getFieldsOrThrow("outputDimensionality").getNumberValue());
        assertEquals(1500L, timeout.get());
    }

    @Test
    void dimensionMismatchIsAModelError() {
        var provider = provider((req, t) -> responseWith(3072));
        var ex = assertThrows(EmbeddingException.class,
                () -> provider.embed("hello", EmbeddingProvider.Task.RETRIEVAL_DOCUMENT));
        assertTrue(ex.getMessage().contains("dimension mismatch"));
    }

    @Test
    void emptyPredictionsIsAModelError() {
        var provider = provider((req, t) -> PredictResponse.getDefaultInstance());
        assertThrows(EmbeddingException.class, () -> provider.embed("hello", EmbeddingProvider.Task.RETRIEVAL_QUERY));
    }

    @Test
    void timeoutAndProviderErrorsAreWrapped() {
        var slow = provider((req, t) -> { throw new TimeoutException(); });
        var ex = assertThrows(EmbeddingException.class, () -> slow.embed("hi", EmbeddingProvider.Task.RETRIEVAL_QUERY));
        assertTrue(ex.getMessage().contains("timed out"));

        var broken = provider((req, t) -> { throw new IllegalStateException("PERMISSION_DENIED"); });
        assertThrows(EmbeddingException.class, () -> broken.embed("hi", EmbeddingProvider.Task.RETRIEVAL_QUERY));
    }

    @Test
    void blankTextIsRejectedWithoutCallingTheModel() {
        var provider = provider((req, t) -> fail("model must not be called"));
        assertThrows(EmbeddingException.class, () -> provider.embed("  ", EmbeddingProvider.Task.RETRIEVAL_QUERY));
    }

    @Test
    void missingProjectIdFailsFast() {
        assertThrows(IllegalArgumentException.class, () -> new VertexEmbeddingProvider(
                (req, t) -> responseWith(768), null, "", "us-central1", "text-embedding-005", 768, 1000));
    }
}
