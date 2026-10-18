package com.ecotrack.ai.agent;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Deterministic checks on the model's final answer:
 * <ul>
 *   <li>numeric grounding: every quantity with a unit must match a number from this turn's tool
 *       results or the user's own message (rounding tolerance); anything else is "ungrounded";</li>
 *   <li>quantity kind: hypothetical results must not be described as "saved/avoided".</li>
 * </ul>
 */
public final class AnswerVerifier {

    public record Verdict(List<String> ungroundedNumbers, boolean savedLanguage) {
        public boolean ok() { return ungroundedNumbers.isEmpty() && !savedLanguage; }
    }

    private static final ObjectMapper JSON = new ObjectMapper();
    static final Pattern CLAIM = Pattern.compile(
            "(?<![\\w.\\[S])([-−]?\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|[-−]?\\d+(?:\\.\\d+)?)\\s?(kg|kgs|g\\b|grams|t\\b|tonnes?|tons?|kwh|%|percent|km)",
            Pattern.CASE_INSENSITIVE);
    static final Pattern NUMBER = Pattern.compile("[-−]?\\d+(?:\\.\\d+)?");
    static final Pattern SAVED = Pattern.compile(
            "(?i)\\b(you(?:'ve| have)? (?:already )?(?:saved|avoided|cut)|you saved|saving you|you're saving|you are saving)\\b");

    /** "0.71 kg/kWh", "0.13 kg CO2 per km", "emission factor": statements that need a factor tool behind them. */
    static final Pattern FACTOR_CLAIM = Pattern.compile(
            "(?i)(\\d+(?:\\.\\d+)?\\s?(?:kg|g)\\s?(?:co2e?|co₂e?)?\\s?(?:/|per)\\s?(?:kwh|km|pkm|vkm|passenger|kg|litre|liter))"
                    + "|\\bemission factor\\b|\\btransmission (?:and|&) distribution\\b|\\bT&D\\b");

    private AnswerVerifier() {}

    public static boolean makesFactorClaims(String answer) {
        return answer != null && FACTOR_CLAIM.matcher(answer).find();
    }

    public static Verdict verify(String answer, List<Map<String, Object>> toolResults, String userMessage) {
        List<Double> allowed = new ArrayList<>();
        for (Map<String, Object> r : toolResults) {
            try {
                collect(JSON.writeValueAsString(r), allowed);
            } catch (Exception ignored) {
                // a result that cannot be serialised contributes no allowed numbers
            }
        }
        collect(userMessage, allowed);
        List<String> ungrounded = new ArrayList<>();
        Matcher m = CLAIM.matcher(answer == null ? "" : answer);
        while (m.find()) {
            String num = m.group(1).replace(",", "").replace("−", "-");
            int decimals = num.contains(".") ? num.length() - num.indexOf('.') - 1 : 0;
            if (!grounded(Double.parseDouble(num), decimals, allowed)) ungrounded.add(m.group().trim());
        }
        return new Verdict(ungrounded, SAVED.matcher(answer == null ? "" : answer).find());
    }

    /**
     * A claim matches a tool number when it is that number rounded to the claim's stated precision
     * (half a unit in the last place) or within 2%. The tolerance scales with the claim: an absolute
     * tolerance would accept any small invented factor (0.03 kg/km) as "grounded".
     */
    static boolean grounded(double v, int decimals, List<Double> allowed) {
        double rounding = 0.5 * Math.pow(10, -decimals) + 1e-9;
        for (double a : allowed) {
            for (double x : new double[]{a, a * 1000, a / 1000}) {   // also g<->kg, kg<->t restatements
                double tol = Math.max(0.02 * Math.abs(x), rounding);
                if (Math.abs(Math.abs(v) - Math.abs(x)) <= tol) return true;
            }
        }
        return v == 0;
    }

    private static void collect(String text, List<Double> into) {
        if (text == null) return;
        Matcher m = NUMBER.matcher(text);
        while (m.find()) {
            try {
                into.add(new BigDecimal(m.group().replace("−", "-")).doubleValue());
            } catch (NumberFormatException ignored) {
                // not a number after all
            }
        }
    }

    /** Last resort after a failed repair: drop sentences that contain ungrounded quantities or "saved" wording. */
    public static String stripUngrounded(String answer, Verdict v) {
        StringBuilder out = new StringBuilder();
        for (String sentence : answer.split("(?<=[.!?])\\s+|\\n")) {
            boolean bad = v.ungroundedNumbers().stream().anyMatch(sentence::contains) || SAVED.matcher(sentence).find();
            if (!bad) {
                if (!out.isEmpty()) out.append(sentence.startsWith("*") || sentence.startsWith("-") ? "\n" : " ");
                out.append(sentence);
            }
        }
        return out.toString().trim();
    }
}
