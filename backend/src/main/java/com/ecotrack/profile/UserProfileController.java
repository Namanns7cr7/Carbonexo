package com.ecotrack.profile;

import com.ecotrack.profile.dto.ProfileResponse;
import com.ecotrack.security.SecurityUtils;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/profiles")
public class UserProfileController {

    private final UserProfileService service;

    public UserProfileController(UserProfileService service) {
        this.service = service;
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
