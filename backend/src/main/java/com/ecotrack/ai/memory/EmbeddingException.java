package com.ecotrack.ai.memory;

/** Embedding generation failed (provider error, timeout, or unexpected output shape). */
public class EmbeddingException extends RuntimeException {

    public EmbeddingException(String message) {
        super(message);
    }

    public EmbeddingException(String message, Throwable cause) {
        super(message, cause);
    }
}
