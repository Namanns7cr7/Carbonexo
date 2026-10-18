package com.ecotrack.factors;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Read-only access to the V12 registry tables. No method writes. */
@Repository
public class FactorRegistryRepository {

    public record MapRow(String activityKey, String region, String variant, String factorId, String status,
                         String quantityUnit, String occupancyRule, String accountingRule, String missingInformation) {}

    private final JdbcTemplate jdbc;

    public FactorRegistryRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Dataset version status (draft/approved/active/retired), empty if the version does not exist or V12 is absent. */
    public Optional<String> datasetStatus(String version) {
        try {
            return jdbc.queryForList("SELECT status FROM factor_dataset_versions WHERE version = ?", String.class, version)
                    .stream().findFirst();
        } catch (DataAccessException e) {
            return Optional.empty();
        }
    }

    public Optional<MapRow> mapRow(String version, String activityKey, String region, String variant) {
        return jdbc.query("""
                SELECT activity_key, region, variant, factor_id, status, quantity_unit, occupancy_rule, accounting_rule, missing_information
                FROM activity_factor_map WHERE dataset_version = ? AND activity_key = ? AND region = ? AND variant = ?""",
                this::mapRow, version, activityKey, region, variant).stream().findFirst();
    }

    public List<MapRow> variants(String version, String activityKey, String region) {
        return jdbc.query("""
                SELECT activity_key, region, variant, factor_id, status, quantity_unit, occupancy_rule, accounting_rule, missing_information
                FROM activity_factor_map WHERE dataset_version = ? AND activity_key = ? AND region = ?
                ORDER BY variant""", this::mapRow, version, activityKey, region);
    }

    public List<String> activities(String version, String region) {
        return jdbc.queryForList("SELECT DISTINCT activity_key FROM activity_factor_map WHERE dataset_version = ? AND region = ? ORDER BY 1",
                String.class, version, region);
    }

    public Optional<FactorRecord> factor(String version, String factorId) {
        return jdbc.query("""
                SELECT r.factor_id, r.dataset_version, r.value, r.unit, r.region, r.applies_to_regions, r.proxy_regions,
                       r.applicable_year, r.scope, r.system_boundary, r.gases, r.statistic, r.source_id,
                       s.publisher, s.title, s.url, r.source_locator, r.verification_status, r.scientific_status,
                       r.uncertainty_level, r.uncertainty_notes
                FROM factor_records r JOIN factor_sources s ON s.source_id = r.source_id
                WHERE r.dataset_version = ? AND r.factor_id = ?""", (rs, i) -> new FactorRecord(
                rs.getString(1), rs.getString(2), rs.getBigDecimal(3), rs.getString(4), rs.getString(5),
                strings(rs.getArray(6)), strings(rs.getArray(7)), rs.getString(8), rs.getString(9), rs.getString(10),
                rs.getString(11), rs.getString(12), rs.getString(13), rs.getString(14), rs.getString(15), rs.getString(16),
                rs.getString(17), rs.getString(18), rs.getString(19), rs.getString(20), rs.getString(21)), version, factorId)
                .stream().findFirst();
    }

    public Map<String, Object> stats(String version) {
        return jdbc.queryForMap("SELECT (SELECT count(*) FROM factor_records WHERE dataset_version = ?) AS records, "
                + "(SELECT count(*) FROM activity_factor_map WHERE dataset_version = ?) AS mappings", version, version);
    }

    private MapRow mapRow(ResultSet rs, int i) throws SQLException {
        return new MapRow(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5),
                rs.getString(6), rs.getString(7), rs.getString(8), rs.getString(9));
    }

    private static List<String> strings(Array a) throws SQLException {
        return a == null ? List.of() : Arrays.asList((String[]) a.getArray());
    }
}
