package com.ecotrack.exception;

import org.springframework.http.HttpStatus;

public class ResourceNotFoundException extends ApiException {
    public ResourceNotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, message);
    }

    public ResourceNotFoundException(String entity, String field, Object value) {
        super(HttpStatus.NOT_FOUND, entity + " not found: " + field + "=" + value);
    }

    public static ResourceNotFoundException of(String entity, Object id) {
        return new ResourceNotFoundException(entity + " not found: " + id);
    }
}
