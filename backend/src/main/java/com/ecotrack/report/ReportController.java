package com.ecotrack.report;

import com.ecotrack.report.dto.EsgSummaryResponse;
import com.ecotrack.security.SecurityUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService service;

    public ReportController(ReportService service) {
        this.service = service;
    }

    @GetMapping("/esg-summary")
    public ResponseEntity<EsgSummaryResponse> getEsgSummary() {
        return ResponseEntity.ok(service.getEsgSummary(SecurityUtils.currentUserId()));
    }

    @GetMapping(value = "/esg-summary.csv", produces = "text/csv")
    public ResponseEntity<byte[]> getEsgSummaryCsv() {
        EsgSummaryResponse summary = service.getEsgSummary(SecurityUtils.currentUserId());
        byte[] csv = service.toCsv(summary).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .contentType(MediaType.valueOf("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"carbonexo-esg-report.csv\"")
                .body(csv);
    }
}
