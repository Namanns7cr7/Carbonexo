package com.ecotrack.ai.memory;

/** Text embedding provider. No provider-specific code in business services. */
public interface EmbeddingProvider {

    /** Task hint; retrieval models embed queries and documents differently. */
    enum Task { RETRIEVAL_QUERY, RETRIEVAL_DOCUMENT }

    /**
     * Embed one text. Always returns exactly {@link #dimensions()} values.
     *
     * @throws EmbeddingException on any provider, timeout or shape error
     */
    float[] embed(String text, Task task);

    /** Model id stored alongside each vector (vectors from different models never mix). */
    String modelName();

    int dimensions();
}
