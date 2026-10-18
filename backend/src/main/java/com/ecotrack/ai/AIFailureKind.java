package com.ecotrack.ai;

import com.google.api.gax.rpc.ApiException;
import io.grpc.StatusRuntimeException;

import java.net.UnknownHostException;
import java.util.concurrent.TimeoutException;

/** Why a live model call failed. Logged, counted, and returned to callers; never hidden. */
public enum AIFailureKind {
    MODEL_NOT_FOUND,   // 404: model id not served in this project/location (e.g. retired gemini-2.0-flash)
    ENDPOINT,          // UNIMPLEMENTED: wrong endpoint for the location (e.g. "global" without the global host)
    AUTH,              // UNAUTHENTICATED / PERMISSION_DENIED
    QUOTA,             // RESOURCE_EXHAUSTED / 429
    TIMEOUT,           // DEADLINE_EXCEEDED or client-side timeout
    UNAVAILABLE,       // UNAVAILABLE / 5xx
    NETWORK,           // DNS / connection failure
    INVALID_REQUEST,   // INVALID_ARGUMENT / FAILED_PRECONDITION
    BLOCKED,           // safety block or no candidate text
    EMPTY_RESPONSE,
    CIRCUIT_OPEN,      // recent failures: not attempted
    RATE_LIMITED,      // per-user cost guard
    NOT_CONFIGURED,    // provider set to canned / no project
    UNKNOWN;

    /** Classify any throwable thrown by the Vertex SDK (walks the cause chain). */
    public static AIFailureKind classify(Throwable t) {
        for (Throwable c = t; c != null; c = c.getCause()) {
            if (c instanceof AIProviderException ape) return ape.kind();
            if (c instanceof ApiException api) return fromCode(api.getStatusCode().getCode().name());
            if (c instanceof StatusRuntimeException sre) return fromCode(sre.getStatus().getCode().name());
            if (c instanceof TimeoutException) return TIMEOUT;
            if (c instanceof UnknownHostException || c instanceof java.net.ConnectException) return NETWORK;
            if (c.getCause() == c) break;
        }
        return UNKNOWN;
    }

    static AIFailureKind fromCode(String code) {
        return switch (code) {
            case "NOT_FOUND" -> MODEL_NOT_FOUND;
            case "UNIMPLEMENTED" -> ENDPOINT;
            case "UNAUTHENTICATED", "PERMISSION_DENIED" -> AUTH;
            case "RESOURCE_EXHAUSTED" -> QUOTA;
            case "DEADLINE_EXCEEDED" -> TIMEOUT;
            case "UNAVAILABLE", "INTERNAL", "ABORTED" -> UNAVAILABLE;
            case "INVALID_ARGUMENT", "FAILED_PRECONDITION", "OUT_OF_RANGE" -> INVALID_REQUEST;
            default -> UNKNOWN;
        };
    }

    /** Failures that will not fix themselves on retry (configuration problems). */
    public boolean isConfiguration() {
        return this == MODEL_NOT_FOUND || this == ENDPOINT || this == AUTH || this == NOT_CONFIGURED;
    }
}
