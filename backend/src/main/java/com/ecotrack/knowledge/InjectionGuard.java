package com.ecotrack.knowledge;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Retrieved knowledge is DATA. Sentences that read as instructions to the model are dropped and
 * reported (same rule as scripts/dataset_v2/okf_consumer.py, applied again at query time).
 */
public final class InjectionGuard {

    public record Sanitized(String text, List<String> flags) {}

    static final Pattern INSTRUCTION = Pattern.compile(
            "(ignore (all |any )?(previous|prior|above) (instructions|rules)|disregard (the )?(sources|instructions|policy)|"
                    + "you (must|should) (now )?(say|tell|answer|claim)|system (prompt|override)|developer mode|important to the ai|"
                    + "<\\s*/?\\s*(system|tool_result|instructions)\\s*>)", Pattern.CASE_INSENSITIVE);

    private InjectionGuard() {}

    public static Sanitized sanitize(String text) {
        List<String> flags = new ArrayList<>();
        StringBuilder kept = new StringBuilder();
        for (String sentence : (text == null ? "" : text).split("(?<=[.!?])\\s+")) {
            if (INSTRUCTION.matcher(sentence).find()) {
                flags.add(sentence.length() > 160 ? sentence.substring(0, 160) : sentence);
            } else {
                if (!kept.isEmpty()) kept.append(' ');
                kept.append(sentence);
            }
        }
        return new Sanitized(kept.toString(), flags);
    }
}
