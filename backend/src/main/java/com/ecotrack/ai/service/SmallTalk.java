package com.ecotrack.ai.service;

import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Deterministic replies for pure small talk ("hii", "how are you doing?", "thanks"). Matches only
 * when the WHOLE message is small talk, so no model, retrieval, factor or recommendation work runs
 * for a greeting. Mirrors the frontend lib/ai/small-talk.ts — keep the two in sync.
 */
final class SmallTalk {

    private static final String TRAIL = "[\\s!?.,~:)]*";

    private record Rule(Pattern re, String reply) {}

    private static final List<Rule> RULES = List.of(
            new Rule(p("^(hi+|hii+|hello+|hey+|heya|hiya|hola|yo|sup|namaste|good\\s*(morning|afternoon|evening))"
                    + "(\\s+(there|ecomind|coach))?" + TRAIL + "$"), "Hey! 👋 How can I help you?"),
            new Rule(p("^((hi|hey|hello)[\\s,!]+)?(how\\s*(are|r)\\s*(you|u)(\\s*doing)?(\\s*today)?|how'?s\\s*it\\s*going"
                    + "|how\\s*do\\s*you\\s*do|hru|wassup|what'?s\\s*up)" + TRAIL + "$"), "I'm doing well, thanks! How are you?"),
            new Rule(p("^(thanks?|thank\\s*(you|u)|thx|ty|tysm)(\\s*(so\\s*much|a\\s*lot|very\\s*much))?" + TRAIL + "$"),
                    "You're welcome!"),
            new Rule(p("^(bye+|good\\s*bye|goodbye|see\\s*(you|ya)(\\s*later)?|cya|take\\s*care|good\\s*night)" + TRAIL + "$"),
                    "Bye! 🌱 Come back anytime."));

    private SmallTalk() {}

    private static Pattern p(String re) {
        return Pattern.compile(re, Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    }

    static Optional<String> reply(String message) {
        if (message == null) return Optional.empty();
        String q = message.trim();
        if (q.isEmpty() || q.length() > 40) return Optional.empty();
        for (Rule r : RULES) if (r.re().matcher(q).matches()) return Optional.of(r.reply());
        return Optional.empty();
    }
}
