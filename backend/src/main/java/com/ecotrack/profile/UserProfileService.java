package com.ecotrack.profile;

import com.ecotrack.profile.dto.ProfileResponse;
import com.ecotrack.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class UserProfileService {

    private final UserProfileRepository repo;
    private final UserRepository users;

    public UserProfileService(UserProfileRepository repo, UserRepository users) {
        this.repo = repo;
        this.users = users;
    }

    /**
     * Returns the user's profile, auto-creating a default one (name carried over
     * from the account's display name, onboarded=false) if none exists yet — so a
     * freshly registered or Google-signed-in user always has a profile and is sent
     * through onboarding rather than hitting a 404.
     */
    @Transactional
    public ProfileResponse getByUserId(UUID userId) {
        UserProfile p = repo.findByUserIdAndDeletedAtIsNull(userId)
                .orElseGet(() -> {
                    UserProfile fresh = new UserProfile();
                    fresh.setUserId(userId);
                    users.findByIdAndDeletedAtIsNull(userId)
                            .ifPresent(u -> fresh.setName(u.getDisplayName()));
                    fresh.setOnboarded(false);
                    return repo.save(fresh);
                });
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
        // only touch onboarded when explicitly provided, so a plain profile edit
        // does not reset the onboarding flag
        if (req.onboarded() != null) p.setOnboarded(req.onboarded());

        repo.save(p);
        return toResponse(p);
    }

    @Transactional
    public ProfileResponse completeOnboarding(UUID userId) {
        UserProfile p = repo.findByUserIdAndDeletedAtIsNull(userId)
                .orElseGet(() -> {
                    UserProfile fresh = new UserProfile();
                    fresh.setUserId(userId);
                    users.findByIdAndDeletedAtIsNull(userId)
                            .ifPresent(u -> fresh.setName(u.getDisplayName()));
                    return fresh;
                });
        p.setOnboarded(true);
        repo.save(p);
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
