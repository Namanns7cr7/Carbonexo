package com.ecotrack.ai;

/** A classified live-model failure. The message never contains prompt text or credentials. */
public class AIProviderException extends RuntimeException {

    private final AIFailureKind kind;
    private final String model;

    public AIProviderException(AIFailureKind kind, String model, String message, Throwable cause) {
        super("[" + kind + "] model=" + model + ": " + message, cause);
        this.kind = kind;
        this.model = model;
    }

    public AIFailureKind kind() { return kind; }

    public String model() { return model; }
}
