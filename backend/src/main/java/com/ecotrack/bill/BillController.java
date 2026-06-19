package com.ecotrack.bill;

import com.ecotrack.bill.dto.BillCorrectionRequest;
import com.ecotrack.bill.dto.BillResponse;
import com.ecotrack.security.SecurityUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/bills")
public class BillController {

    private final BillService service;

    public BillController(BillService service) {
        this.service = service;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<BillResponse> upload(@RequestParam("file") MultipartFile file) throws IOException {
        UUID userId = SecurityUtils.currentUserId();
        BillResponse response = service.upload(
                userId, file.getBytes(), file.getContentType(), file.getOriginalFilename());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<BillResponse>> list() {
        return ResponseEntity.ok(service.listByUser(SecurityUtils.currentUserId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<BillResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(service.getById(id, SecurityUtils.currentUserId()));
    }

    @PutMapping("/{id}/correct")
    public ResponseEntity<BillResponse> correct(@PathVariable UUID id,
                                                 @RequestBody BillCorrectionRequest req) {
        return ResponseEntity.ok(service.correct(id, SecurityUtils.currentUserId(), req));
    }
}
