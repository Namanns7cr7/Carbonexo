package com.ecotrack.carbon;

import com.ecotrack.carbon.dto.DashboardResponse;
import com.ecotrack.carbon.dto.EmissionFactorResponse;
import com.ecotrack.security.SecurityUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class DashboardController {

    private final DashboardService dashboardService;
    private final CarbonCalculationService carbonService;

    public DashboardController(DashboardService dashboardService,
                                CarbonCalculationService carbonService) {
        this.dashboardService = dashboardService;
        this.carbonService = carbonService;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardResponse> getDashboard() {
        return ResponseEntity.ok(dashboardService.getDashboard(SecurityUtils.currentUserId()));
    }

    @GetMapping("/emission-factors")
    public ResponseEntity<List<EmissionFactorResponse>> getFactors(
            @RequestParam(defaultValue = "GLOBAL") String region) {
        List<EmissionFactorResponse> factors = carbonService.getActiveFactors(region).stream()
                .map(ef -> new EmissionFactorResponse(
                        ef.getId(), ef.getCategory(), ef.getFactorKey(),
                        ef.getLabel(), ef.getEmoji(), ef.getUnit(),
                        ef.getFactorKgPerUnit().doubleValue(),
                        ef.getDefaultQty() != null ? ef.getDefaultQty().doubleValue() : 1.0
                )).toList();
        return ResponseEntity.ok(factors);
    }
}
