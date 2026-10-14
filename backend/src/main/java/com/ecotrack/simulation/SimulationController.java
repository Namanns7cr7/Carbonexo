package com.ecotrack.simulation;

import com.ecotrack.security.SecurityUtils;
import com.ecotrack.simulation.dto.SimulationRequest;
import com.ecotrack.simulation.dto.SimulationResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Carbon twin simulations — read-only "what if" projections, nothing persisted. */
@RestController
@RequestMapping("/api/simulations")
public class SimulationController {

    private final SimulationService simulationService;

    public SimulationController(SimulationService simulationService) {
        this.simulationService = simulationService;
    }

    @PostMapping
    public ResponseEntity<SimulationResponse> simulate(@Valid @RequestBody SimulationRequest request) {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(simulationService.simulate(userId, request));
    }
}
