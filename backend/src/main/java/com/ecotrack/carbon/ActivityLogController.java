package com.ecotrack.carbon;

import com.ecotrack.carbon.dto.ActivityLogRequest;
import com.ecotrack.carbon.dto.ActivityLogResponse;
import com.ecotrack.exception.ResourceNotFoundException;
import com.ecotrack.security.SecurityUtils;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/activities")
public class ActivityLogController {

    private final ActivityLogRepository repo;

    public ActivityLogController(ActivityLogRepository repo) {
        this.repo = repo;
    }

    @PostMapping
    public ResponseEntity<ActivityLogResponse> create(@Valid @RequestBody ActivityLogRequest req) {
        UUID userId = SecurityUtils.currentUserId();
        ActivityLog log = new ActivityLog();
        log.setUserId(userId);
        log.setCategory(req.category());
        log.setFactorKey(req.factorKey());
        log.setLabel(req.label());
        log.setEmoji(req.emoji());
        log.setQuantity(req.quantity() != null ? BigDecimal.valueOf(req.quantity()) : null);
        log.setUnit(req.unit());
        log.setCo2Kg(BigDecimal.valueOf(req.co2Kg()));
        log.setNote(req.note());
        log.setActivityDate(LocalDate.parse(req.activityDate()));
        log.setSource("manual");
        repo.save(log);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(log));
    }

    @GetMapping
    public ResponseEntity<List<ActivityLogResponse>> list(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        UUID userId = SecurityUtils.currentUserId();
        List<ActivityLog> logs;
        if (from != null && to != null) {
            logs = repo.findByUserIdAndDateRange(userId, LocalDate.parse(from), LocalDate.parse(to));
        } else {
            logs = repo.findByUserIdAndDeletedAtIsNullOrderByActivityDateDescCreatedAtDesc(userId);
        }
        return ResponseEntity.ok(logs.stream().map(this::toResponse).toList());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        UUID userId = SecurityUtils.currentUserId();
        ActivityLog log = repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ActivityLog", "id", id));
        if (!log.getUserId().equals(userId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        log.setDeletedAt(java.time.Instant.now());
        repo.save(log);
        return ResponseEntity.noContent().build();
    }

    private ActivityLogResponse toResponse(ActivityLog a) {
        return new ActivityLogResponse(
                a.getId(), a.getCategory(), a.getFactorKey(), a.getLabel(), a.getEmoji(),
                a.getQuantity() != null ? a.getQuantity().doubleValue() : null,
                a.getUnit(), a.getCo2Kg().doubleValue(), a.getNote(),
                a.getActivityDate().toString(), a.getSource()
        );
    }
}
