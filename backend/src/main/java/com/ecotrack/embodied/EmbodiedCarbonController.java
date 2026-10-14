package com.ecotrack.embodied;

import com.ecotrack.embodied.dto.ProductEstimateRequest;
import com.ecotrack.embodied.dto.ProductEstimateResponse;
import com.ecotrack.embodied.dto.ProductLookupRequest;
import com.ecotrack.embodied.dto.ProductLookupResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Embodied-carbon-for-purchases endpoints. Like other authenticated POST
 * endpoints (e.g. {@code ActivityLogController}), authentication is enforced
 * by the global security filter chain ({@code SecurityConfig} — everything
 * not explicitly public requires a valid bearer JWT); no per-method
 * {@code @PreAuthorize} is needed since these endpoints have no
 * role-specific or ownership checks beyond "is logged in".
 */
@RestController
@RequestMapping("/api/products")
public class EmbodiedCarbonController {

    private final EmbodiedCarbonService service;

    public EmbodiedCarbonController(EmbodiedCarbonService service) {
        this.service = service;
    }

    @PostMapping("/lookup")
    public ResponseEntity<ProductLookupResponse> lookup(@Valid @RequestBody ProductLookupRequest req) {
        return ResponseEntity.ok(service.lookupProduct(req.barcode()));
    }

    @PostMapping("/estimate")
    public ResponseEntity<ProductEstimateResponse> estimate(@Valid @RequestBody ProductEstimateRequest req) {
        return ResponseEntity.ok(service.estimateEmbodiedCarbon(req.category(), req.quantity(), req.productName()));
    }
}
