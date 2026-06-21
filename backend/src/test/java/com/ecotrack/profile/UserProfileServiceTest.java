package com.ecotrack.profile;

import com.ecotrack.profile.dto.ProfileResponse;
import com.ecotrack.user.User;
import com.ecotrack.user.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class UserProfileServiceTest {

    private final UserProfileRepository repo = mock(UserProfileRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final UserProfileService service = new UserProfileService(repo, users);

    private final UUID userId = UUID.randomUUID();

    @Test
    void getByUserIdAutoCreatesDefaultProfileWhenMissing() {
        when(repo.findByUserIdAndDeletedAtIsNull(userId)).thenReturn(Optional.empty());
        User u = mock(User.class);
        when(u.getDisplayName()).thenReturn("Yash");
        when(users.findByIdAndDeletedAtIsNull(userId)).thenReturn(Optional.of(u));
        when(repo.save(any(UserProfile.class))).thenAnswer(inv -> inv.getArgument(0));

        ProfileResponse res = service.getByUserId(userId);

        assertEquals("Yash", res.name());
        assertFalse(res.onboarded());
        verify(repo).save(any(UserProfile.class));
    }

    @Test
    void getByUserIdReturnsExistingProfileWithoutSaving() {
        UserProfile existing = new UserProfile();
        existing.setUserId(userId);
        existing.setName("Existing");
        existing.setOnboarded(true);
        when(repo.findByUserIdAndDeletedAtIsNull(userId)).thenReturn(Optional.of(existing));

        ProfileResponse res = service.getByUserId(userId);

        assertEquals("Existing", res.name());
        assertTrue(res.onboarded());
        verify(repo, never()).save(any());
    }

    @Test
    void createOrUpdateAppliesOnlyNonNullFields() {
        UserProfile existing = new UserProfile();
        existing.setUserId(userId);
        existing.setName("Old");
        existing.setDiet("vegan");
        existing.setOnboarded(true);
        when(repo.findByUserIdAndDeletedAtIsNull(userId)).thenReturn(Optional.of(existing));
        when(repo.save(any(UserProfile.class))).thenAnswer(inv -> inv.getArgument(0));

        // only name provided; diet and onboarded should be untouched
        ProfileRequest req = new ProfileRequest("New", null, null, null, null, null, null, null);
        ProfileResponse res = service.createOrUpdate(userId, req);

        assertEquals("New", res.name());
        assertEquals("vegan", res.diet());
        assertTrue(res.onboarded(), "plain edit must not reset onboarding flag");
    }

    @Test
    void completeOnboardingSetsFlagTrue() {
        UserProfile existing = new UserProfile();
        existing.setUserId(userId);
        existing.setOnboarded(false);
        when(repo.findByUserIdAndDeletedAtIsNull(userId)).thenReturn(Optional.of(existing));
        when(repo.save(any(UserProfile.class))).thenAnswer(inv -> inv.getArgument(0));

        ProfileResponse res = service.completeOnboarding(userId);

        assertTrue(res.onboarded());
        verify(repo).save(any(UserProfile.class));
    }
}
