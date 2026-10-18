package com.ecotrack.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Static fallback used when no live model answers (or for development without GCP credentials).
 *
 * <p>Rules for every text here: generic guidance only; no statements about the user ("you
 * primarily use a car", "your footprint decreased by 8%"); no invented numbers. Each text says it
 * is offline guidance. Callers receive {@link AIResult#live()} = false and must label it.
 */
public class CannedFallbackProvider implements AIProvider {

    public static final String PROVIDER_NAME = "canned-fallback";
    static final String OFFLINE_NOTE = " (Offline guidance: the AI coach is unavailable right now, so this is not personalised.)";

    private static final Logger log = LoggerFactory.getLogger(CannedFallbackProvider.class);

    @Override
    public String generate(String prompt, String model) {
        log.info("CannedFallbackProvider — returning static, non-personalised text (requested model={})", model);

        if (prompt.contains("reduction") || prompt.contains("recommend")) {
            return """
                [{"title":"Look at your most frequent car trips","detail":"Shared or public transport for regular trips is usually the largest single lever. The AI coach can estimate it once it is available.","est_saving_kg":null},
                 {"title":"Check your electricity bill","detail":"Your bill's kWh is the most reliable electricity number you have; log it rather than individual appliances.","est_saving_kg":null},
                 {"title":"Log meals by ingredient","detail":"Meal footprints depend on what is in them; ingredient weights allow an estimate.","est_saving_kg":null}]
                """;
        }
        if (prompt.contains("electricity") || prompt.contains("kWh")) {
            return "Log your bill's kWh so emissions can be estimated from your actual use. Raising the AC set-point "
                    + "and switching off standby loads are common ways to reduce electricity use." + OFFLINE_NOTE;
        }
        if (prompt.contains("transport") || prompt.contains("travel")) {
            return "For regular trips, public or shared transport usually has lower emissions per person than "
                    + "driving alone. Log your trips with distance to get an estimate." + OFFLINE_NOTE;
        }
        if (prompt.contains("scenario") || prompt.contains("hypothetical")) {
            return "This is a what-if result, not a measured change. The numbers above come from the simulation "
                    + "itself." + OFFLINE_NOTE;
        }
        if (prompt.contains("persuasive")) {
            return "A second-hand or refurbished option can avoid making a new product; how much depends on the "
                    + "product." + OFFLINE_NOTE;
        }
        if (prompt.contains("leaderboard")) {
            return "Group totals reflect what members have logged; members who have not logged are missing "
                    + "data, not zero." + OFFLINE_NOTE;
        }
        if (prompt.contains("tip") || prompt.contains("sustainability")) {
            return "Carry a reusable bottle and bag today to cut single-use plastic." + OFFLINE_NOTE;
        }
        if (prompt.contains("report") || prompt.contains("monthly")) {
            return "Your monthly report needs the AI coach, which is unavailable right now. Your logged totals on "
                    + "the dashboard are unaffected." + OFFLINE_NOTE;
        }
        return "The AI coach is unavailable right now. You can still log activities and see your logged totals." + OFFLINE_NOTE;
    }

    @Override
    public AIResult generateResult(String prompt, String model) {
        return AIResult.fallback(generate(prompt, model), AIFailureKind.NOT_CONFIGURED, 0);
    }

    /** Canned text is not a live answer. */
    @Override
    public String generateLive(String prompt, String model) {
        throw new IllegalStateException("No live AI provider available (canned fallback only)");
    }

    @Override
    public String providerName() {
        return PROVIDER_NAME;
    }
}
