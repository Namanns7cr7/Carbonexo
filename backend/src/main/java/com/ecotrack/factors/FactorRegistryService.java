package com.ecotrack.factors;

import com.ecotrack.config.AppConfigService;
import com.ecotrack.factors.FactorLookup.Authority;
import com.ecotrack.factors.FactorLookup.Reason;
import com.ecotrack.factors.FactorLookup.Status;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Authoritative, deterministic emission-factor lookup over the Dataset V2 registry.
 *
 * <ul>
 *   <li>Only the configured dataset version is read ({@code factors.dataset_version}).</li>
 *   <li>APPROVED/ACTIVE versions are authoritative. A DRAFT (unreviewed candidate) version answers
 *       only when {@code factors.allow_candidate=true} (staging), and every result says CANDIDATE.</li>
 *   <li>A factor is returned only if the user's region is in its {@code applies_to_regions} (direct)
 *       or {@code proxy_regions} (labelled proxy). A UK/US factor is therefore never returned for an
 *       Indian user (also enforced by the V12 CHECK constraint).</li>
 *   <li>No similarity search, no defaults, no substitutions: a gap is a structured NOT_ESTIMATED.</li>
 *   <li>{@code approvedOnly} (safe_limited coach mode) ignores {@code factors.allow_candidate}: only an
 *       APPROVED/ACTIVE dataset answers.</li>
 * </ul>
 */
@Service
public class FactorRegistryService {

    private static final Logger log = LoggerFactory.getLogger(FactorRegistryService.class);
    private static final Set<String> ZERO_OPERATIONAL = Set.of("walk", "bike", "cycling", "walking");

    public record Calculation(BigDecimal kg, String formula, Map<String, Object> receipt) {}

    private final FactorRegistryRepository repo;
    private final AppConfigService config;

    public FactorRegistryService(FactorRegistryRepository repo, AppConfigService config) {
        this.repo = repo;
        this.config = config;
    }

    public String datasetVersion() {
        return config.getOrDefault("factors.dataset_version", "2.0.0-candidate.2");
    }

    /** APPROVED / CANDIDATE authority for the configured dataset, or empty when nothing may answer. */
    public Optional<Authority> authority() {
        return authority(false);
    }

    public Optional<Authority> authority(boolean approvedOnly) {
        Optional<String> status = repo.datasetStatus(datasetVersion());
        if (status.isEmpty()) return Optional.empty();
        return switch (status.get()) {
            case "approved", "active" -> Optional.of(Authority.APPROVED);
            case "draft" -> !approvedOnly && config.getBool("factors.allow_candidate", false) ? Optional.of(Authority.CANDIDATE) : Optional.empty();
            default -> Optional.empty();
        };
    }

    public FactorLookup lookup(String activityKey, String region, String variant) {
        return lookup(activityKey, region, variant, false);
    }

    public FactorLookup lookup(String activityKey, String region, String variant, boolean approvedOnly) {
        return lookup(activityKey, region, variant, approvedOnly, null);
    }

    /** {@code knownAuthority}: already resolved by the caller (saves a dataset-status query per variant). */
    private FactorLookup lookup(String activityKey, String region, String variant, boolean approvedOnly, Optional<Authority> knownAuthority) {
        String activity = normalize(activityKey);
        String reg = region == null ? "" : region.trim().toUpperCase(Locale.ROOT);
        String var = variant == null || variant.isBlank() ? "default" : normalize(variant);
        if (activity.isEmpty()) {
            return FactorLookup.notEstimated(activityKey, reg, var, Reason.UNKNOWN_ACTIVITY, "an activity name");
        }
        if (ZERO_OPERATIONAL.contains(activity)) {
            return new FactorLookup(Status.ESTIMATED, activity, reg, var, Authority.DEFINITION, null, false, "km", null,
                    "operational_zero", Reason.OK, null);
        }
        if (reg.isEmpty() || reg.equals("GLOBAL")) {
            return FactorLookup.notEstimated(activity, reg, var, Reason.REGION_UNCONFIRMED, "your confirmed country/region");
        }
        Optional<Authority> authority = knownAuthority != null ? knownAuthority : authority(approvedOnly);
        if (authority.isEmpty()) {
            return FactorLookup.notEstimated(activity, reg, var, Reason.NO_APPROVED_DATASET,
                    "a reviewed and approved emission-factor dataset");
        }
        String version = datasetVersion();
        Optional<FactorRegistryRepository.MapRow> row = repo.mapRow(version, activity, reg, var);
        if (row.isEmpty()) {
            if (!"default".equals(var)) {
                return FactorLookup.notEstimated(activity, reg, var, Reason.NO_FACTOR_FOR_REGION,
                        "a factor for variant '" + var + "' of " + activity + " in " + reg);
            }
            List<FactorRegistryRepository.MapRow> vs = repo.variants(version, activity, reg);
            return vs.isEmpty()
                    ? FactorLookup.notEstimated(activity, reg, var, Reason.NO_FACTOR_FOR_REGION, "an emission factor for " + activity + " in " + reg)
                    : FactorLookup.notEstimated(activity, reg, var, Reason.VARIANT_REQUIRED, "which type: " + String.join(", ", variantNames(vs)));
        }
        var m = row.get();
        if ("not_estimated".equals(m.status()) || m.factorId() == null) {
            List<FactorRegistryRepository.MapRow> vs = repo.variants(version, activity, reg).stream()
                    .filter(v -> v.factorId() != null && !"default".equals(v.variant())).toList();
            Reason reason = vs.isEmpty() ? Reason.MAPPED_NOT_ESTIMATED : Reason.VARIANT_REQUIRED;
            return FactorLookup.notEstimated(activity, reg, var, reason, m.missingInformation());
        }
        Optional<FactorRecord> f = repo.factor(version, m.factorId());
        if (f.isEmpty()) {
            log.error("activity_factor_map points at missing factor {} in {}", m.factorId(), version);
            return FactorLookup.notEstimated(activity, reg, var, Reason.NO_FACTOR_FOR_REGION, "an emission factor for " + activity);
        }
        FactorRecord rec = f.get();
        boolean direct = rec.appliesToRegions().contains(reg);
        boolean proxy = !direct && rec.proxyRegions().contains(reg);
        if (!direct && !proxy) {
            log.error("Refusing factor {} (region {}) for user region {}: not applicable", rec.factorId(), rec.region(), reg);
            return FactorLookup.notEstimated(activity, reg, var, Reason.NOT_APPLICABLE_TO_REGION, "an emission factor that applies to " + reg);
        }
        if ("unsupported".equals(rec.scientificStatus())) {
            return FactorLookup.notEstimated(activity, reg, var, Reason.UNSUPPORTED_FACTOR, "a supported emission factor for " + activity);
        }
        Status status = proxy || "provisional".equals(m.status()) || "provisional".equals(rec.scientificStatus())
                ? Status.PROVISIONAL : Status.ESTIMATED;
        return new FactorLookup(status, activity, reg, var, authority.get(), rec, proxy, m.quantityUnit(),
                m.occupancyRule(), m.accountingRule(), Reason.OK, null);
    }

    /** All estimable variants of an activity in a region (e.g. car types), for range answers. */
    public List<FactorLookup> estimableVariants(String activityKey, String region) {
        return estimableVariants(activityKey, region, false);
    }

    public List<FactorLookup> estimableVariants(String activityKey, String region, boolean approvedOnly) {
        String activity = normalize(activityKey);
        String reg = region == null ? "" : region.trim().toUpperCase(Locale.ROOT);
        Optional<Authority> authority = authority(approvedOnly);
        if (authority.isEmpty() || reg.isEmpty() || reg.equals("GLOBAL")) return List.of();
        List<FactorLookup> out = new ArrayList<>();
        for (var v : repo.variants(datasetVersion(), activity, reg)) {
            if (v.factorId() == null || "default".equals(v.variant())) continue;
            FactorLookup l = lookup(activity, reg, v.variant(), approvedOnly, authority);
            if (l.estimated()) out.add(l);
        }
        return out;
    }

    /** The unit an activity's factors are expressed per (km, kWh, kg, item, ...), or empty when unmapped. */
    public Optional<String> quantityUnit(String activityKey, String region) {
        String reg = region == null ? "" : region.trim().toUpperCase(Locale.ROOT);
        return repo.variants(datasetVersion(), normalize(activityKey), reg).stream()
                .map(FactorRegistryRepository.MapRow::quantityUnit).filter(u -> u != null && !u.isBlank()).findFirst();
    }

    public List<String> knownActivities(String region) {
        String reg = region == null ? "" : region.trim().toUpperCase(Locale.ROOT);
        return reg.isEmpty() ? List.of() : repo.activities(datasetVersion(), reg);
    }

    /**
     * Deterministic emissions for a quantity: kg = quantity x factor / occupancy (3 dp). Occupancy only
     * divides per-vehicle factors whose mapping allows it. Throws on misuse rather than guessing.
     */
    public Calculation calculate(FactorLookup lookup, BigDecimal quantity, Integer occupancy) {
        if (!lookup.estimated()) throw new IllegalArgumentException("not estimated: " + lookup.reason());
        if (quantity == null || quantity.signum() < 0) throw new IllegalArgumentException("quantity must be >= 0");
        int occ = occupancy == null ? 1 : occupancy;
        if (occ < 1) throw new IllegalArgumentException("occupancy must be >= 1");
        if (occ > 1 && !"divide_by_stated_occupancy".equals(lookup.occupancyRule())) {
            throw new IllegalArgumentException("occupancy only divides per-vehicle factors");
        }
        BigDecimal factorValue = lookup.factor() == null ? BigDecimal.ZERO : lookup.factor().value();
        BigDecimal kg = quantity.multiply(factorValue).divide(BigDecimal.valueOf(occ), 3, RoundingMode.HALF_UP);
        String fid = lookup.factor() == null ? "definition:operational_zero" : lookup.factor().factorId();
        Map<String, Object> receipt = new LinkedHashMap<>();
        receipt.put("factor_id", fid);
        receipt.put("dataset_version", lookup.factor() == null ? null : lookup.factor().datasetVersion());
        receipt.put("factor_value", factorValue);
        receipt.put("quantity", quantity);
        receipt.put("occupancy", occ);
        receipt.put("result_kg", kg);
        String formula = quantity.stripTrailingZeros().toPlainString() + " x " + factorValue.stripTrailingZeros().toPlainString()
                + (occ > 1 ? " / " + occ : "");
        return new Calculation(kg, formula, receipt);
    }

    /** Re-derives a receipt's result from the registry (attestation, no LLM). */
    public boolean attest(Map<String, Object> receipt) {
        Object fid = receipt.get("factor_id");
        if ("definition:operational_zero".equals(fid)) return BigDecimal.ZERO.compareTo(new BigDecimal(receipt.get("result_kg").toString())) == 0;
        Optional<FactorRecord> f = repo.factor(String.valueOf(receipt.get("dataset_version")), String.valueOf(fid));
        if (f.isEmpty()) return false;
        BigDecimal q = new BigDecimal(receipt.get("quantity").toString());
        int occ = Integer.parseInt(receipt.get("occupancy").toString());
        BigDecimal expect = q.multiply(f.get().value()).divide(BigDecimal.valueOf(occ), 3, RoundingMode.HALF_UP);
        return expect.compareTo(new BigDecimal(receipt.get("result_kg").toString())) == 0
                && f.get().value().compareTo(new BigDecimal(receipt.get("factor_value").toString())) == 0;
    }

    private static List<String> variantNames(List<FactorRegistryRepository.MapRow> rows) {
        return rows.stream().map(FactorRegistryRepository.MapRow::variant).filter(v -> !"default".equals(v)).toList();
    }

    private static String normalize(String s) {
        // "Car Ride" -> car_ride; food-by-weight keys keep their "food:" prefix (food:other_pulses)
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
    }
}
