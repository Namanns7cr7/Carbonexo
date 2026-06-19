package com.ecotrack.profile;

import com.ecotrack.exception.ResourceNotFoundException;
import com.ecotrack.profile.dto.ProfileResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class UserProfileService {

    private final UserProfileRepository repo;

    public UserProfileService(UserProfileRepository repo) {
        this.repo = repo;
    }

    public ProfileResponse getByUserId(UUID userId) {
        UserProfile p = repo.findByUserIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", "userId", userId));
        return toResponse(p);
    }

    @Transactional
    public ProfileResponse createOrUpdate(UUID userId, ProfileRequest req) {
        UserProfile p = repo.findByUserIdAndDeletedAtIsNull(userId)
                .orElseGet(() -> {
                    UserProfile fresh = new UserProfile();
                    fresh.setUserId(userId);
                    return fresh;
                });

        if (req.name() != null) p.setName(req.name());
        if (req.travelMode() != null) p.setTravelMode(req.travelMode());
        if (req.dailyDistanceKm() != null) p.setDailyDistanceKm(req.dailyDistanceKm());
        if (req.diet() != null) p.setDiet(req.diet());
        if (req.electricityUsage() != null) p.setElectricityUsage(req.electricityUsage());
        if (req.shoppingHabit() != null) p.setShoppingHabit(req.shoppingHabit());
        if (req.weeklyGoalPct() != null) p.setWeeklyGoalPct(req.weeklyGoalPct());
        p.setOnboarded(req.onboarded());

        repo.save(p);
        return toResponse(p);
    }

    @Transactional
    public ProfileResponse completeOnboarding(UUID userId) {
        UserProfile p = repo.findByUserIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", "userId", userId));
        p.setOnboarded(true);
        return toResponse(p);
    }

    private ProfileResponse toResponse(UserProfile p) {
        return new ProfileResponse(
                p.getId(), p.getUserId(), p.getName(), p.getTravelMode(),
                p.getDailyDistanceKm(), p.getDiet(), p.getElectricityUsage(),
                p.getShoppingHabit(), p.getWeeklyGoalPct(), p.getRegion(), p.isOnboarded()
        );
    }
}
