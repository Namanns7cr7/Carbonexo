package com.ecotrack.profile;

import com.ecotrack.profile.dto.ProfileRequest;
import com.ecotrack.profile.dto.ProfileResponse;
import com.ecotrack.security.SecurityUtils;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/profiles")
public class UserProfileController {

    private final UserProfileService service;
    private final RegionConfirmationService regions;

    public UserProfileController(UserProfileService service, RegionConfirmationService regions) {
        this.service = service;
        this.regions = regions;
    }

    @GetMapping("/me/region")
    public ResponseEntity<java.util.Map<String, Object>> myRegion() {
        return ResponseEntity.ok(regions.status(SecurityUtils.currentUserId()));
    }

    /** The user's explicit region choice for emission factors: {"region":"IN"}. */
    @PostMapping("/me/region")
    public ResponseEntity<java.util.Map<String, Object>> confirmRegion(@RequestBody java.util.Map<String, String> body) {
        return ResponseEntity.ok(regions.confirm(SecurityUtils.currentUserId(), body == null ? null : body.get("region")));
    }

    @GetMapping("/me")
    public ResponseEntity<ProfileResponse> getMyProfile() {
        return ResponseEntity.ok(service.getByUserId(SecurityUtils.currentUserId()));
    }

    @PutMapping("/me")
    public ResponseEntity<ProfileResponse> updateMyProfile(@Valid @RequestBody ProfileRequest req) {
        return ResponseEntity.ok(service.createOrUpdate(SecurityUtils.currentUserId(), req));
    }

    @PostMapping("/me/onboarding")
    public ResponseEntity<ProfileResponse> completeOnboarding() {
        return ResponseEntity.ok(service.completeOnboarding(SecurityUtils.currentUserId()));
    }
}
