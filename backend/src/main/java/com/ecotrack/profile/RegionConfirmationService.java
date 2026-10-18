package com.ecotrack.profile;

import com.ecotrack.exception.BadRequestException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * The user's explicit choice of region for emission factors (V13 region_confirmed / region_source).
 * Only the user sets it, through this call; it is never inferred from IP or locale. Confirming a
 * region selects which factors apply; it says nothing about whether those factors are approved.
 */
@Service
public class RegionConfirmationService {

    private final JdbcTemplate jdbc;
    private final UserProfileService profiles;

    public RegionConfirmationService(JdbcTemplate jdbc, UserProfileService profiles) {
        this.jdbc = jdbc;
        this.profiles = profiles;
    }

    /** Regions the factor registry has factors for, plus GLOBAL. */
    public List<String> supportedRegions() {
        List<String> regions = jdbc.queryForList("SELECT DISTINCT region FROM factor_records ORDER BY region", String.class);
        return regions.contains("GLOBAL") ? regions : java.util.stream.Stream.concat(regions.stream(), java.util.stream.Stream.of("GLOBAL")).toList();
    }

    @Transactional
    public Map<String, Object> confirm(UUID userId, String requested) {
        String region = requested == null ? "" : requested.trim().toUpperCase(Locale.ROOT);
        List<String> supported = supportedRegions();
        if (!supported.contains(region)) {
            throw new BadRequestException("region must be one of " + supported);
        }
        profiles.getByUserId(userId);   // creates the profile row if this user has none yet
        String previous = jdbc.queryForObject("SELECT region FROM user_profiles WHERE user_id = ? AND deleted_at IS NULL", String.class, userId);
        String source = region.equals(previous) ? "user_confirmed" : "user_changed";
        jdbc.update("""
                UPDATE user_profiles SET region = ?, region_confirmed = TRUE, region_source = ?, region_confirmed_at = now(), updated_at = now()
                WHERE user_id = ? AND deleted_at IS NULL""", region, source, userId);
        return status(userId);
    }

    public Map<String, Object> status(UUID userId) {
        profiles.getByUserId(userId);
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT region, region_confirmed, region_source FROM user_profiles WHERE user_id = ? AND deleted_at IS NULL", userId);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("region", row.get("region"));
        m.put("confirmed", row.get("region_confirmed"));
        m.put("source", row.get("region_source"));
        m.put("supported", supportedRegions());
        return m;
    }
}
