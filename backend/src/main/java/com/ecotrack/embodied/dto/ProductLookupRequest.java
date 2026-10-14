package com.ecotrack.embodied.dto;

import jakarta.validation.constraints.NotBlank;

public record ProductLookupRequest(
        @NotBlank String barcode
) {}
