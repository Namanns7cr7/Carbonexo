package com.ecotrack.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Canned/fallback AI provider for development without GCP credentials.
 * Returns static, helpful responses.
 */
public class CannedFallbackProvider implements AIProvider {

    private static final Logger log = LoggerFactory.getLogger(CannedFallbackProvider.class);

    @Override
    public String generate(String prompt, String model) {
        log.info("CannedFallbackProvider — returning static response (model={})", model);

        if (prompt.contains("reduction") || prompt.contains("recommend")) {
            return """
                [{"title":"Switch to metro for short commutes","detail":"Taking the metro instead of driving for trips under 10km can save significant emissions.","est_saving_kg":4.2},
                 {"title":"Try two meat-free dinners this week","detail":"Plant-based meals have a much lower carbon footprint than meat-based ones.","est_saving_kg":3.1},
                 {"title":"Unplug devices when not in use","detail":"Standby power consumption adds up. Use power strips for easy switching.","est_saving_kg":1.5}]
                """;
        }

        if (prompt.contains("electricity") || prompt.contains("kWh")) {
            return "Your electricity usage is moderate. Consider using energy-efficient appliances and " +
                   "turning off lights when leaving rooms. Setting your AC to 24°C instead of 22°C can " +
                   "reduce consumption by 15%. Your usage trend shows a slight increase — monitor peak hours.";
        }

        if (prompt.contains("transport") || prompt.contains("travel")) {
            return "You primarily use a car for commuting. Consider carpooling for longer trips — this can " +
                   "halve your per-person emissions. The metro is great for distances under 15km. " +
                   "Potential saving: ~5 kg CO₂/week by switching 2 car trips to metro.";
        }

        if (prompt.contains("tip") || prompt.contains("sustainability")) {
            return "Small daily choices add up! Try bringing a reusable bag and water bottle today — " +
                   "it's an easy win that reduces plastic waste and feels great. 🌱";
        }

        if (prompt.contains("report") || prompt.contains("monthly")) {
            return "Great month! You tracked consistently and your carbon footprint decreased by 8% " +
                   "compared to last month. Your biggest win was switching to metro on 3 days. " +
                   "Focus area: food emissions increased slightly — try one more veggie day next month!";
        }

        return "I'm your sustainability coach! I can help with carbon reduction tips, " +
               "electricity analysis, transport insights, and more. What would you like to know?";
    }

    @Override
    public String providerName() {
        return "canned";
    }
}
