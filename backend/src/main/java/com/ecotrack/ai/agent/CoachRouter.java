package com.ecotrack.ai.agent;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Deterministic question routing. Each question type has a contract: tools that MUST run before the
 * model answers (forced with function-calling mode ANY, so the model only chooses arguments) and
 * answer rules added to the system instruction. Numerical policy lives here and in the tools, not
 * in the model's memory.
 *
 * <p>Conservative by design: a missed route falls back to the normal tool loop (AUTO); a wrong route
 * costs one tool call. At most {@link #MAX_FORCED} tools are forced.
 */
public final class CoachRouter {

    static final int MAX_FORCED = 2;

    public enum Intent {
        OTHER_PEOPLE, SAVINGS_CLAIM, DOUBLE_COUNTING, SCENARIO, COMPARISON, QUANTITY_ESTIMATE, UNIT_CONVERSION,
        TARGET, FACTOR, PERSONAL_TREND, PERSONAL, RECOMMENDATION, EXPLANATION, GENERAL
    }

    public record Route(List<Intent> intents, List<String> requiredTools, String contract) {
        public Intent primary() { return intents.isEmpty() ? Intent.GENERAL : intents.get(0); }
    }

    private static final String ACTIVITY = "(car|drive|driv|petrol|diesel|cng|ev\\b|bus|metro|train|rail|auto|rickshaw|scooter|bike|motorbike|"
            + "taxi|cab|flight|fly|walk|cycl|electricity|kwh|ac\\b|air.?condition|geyser|heater|laundry|meal|beef|chicken|mutton|fish|"
            + "rice|dal|pulses|milk|paneer|egg|food|delivery|grocer|phone|laptop|clothing|shirt|jeans|waste|bottle|plastic)";
    private static final Pattern OTHER_PEOPLE = p("\\b(other (people|users)|all (carbonexo )?users|everyone else|someone else|"
            + "my (friend|neighbou?r|colleague|brother|sister|wife|husband|partner|flatmate|roommate)'?s?|another user|"
            + "user (id|#)|[0-9a-f]{8}-[0-9a-f]{4}-|@[a-z0-9-]+\\.[a-z]{2,}|people in my (city|area)|leaderboard of)");
    private static final Pattern SAVINGS = p("\\b(saved|saving|savings|avoided|offset|carbon.?neutral|net.?zero|certif|verified|"
            + "congratulat|credits? (mean|=|are)|reduction is|lifetime co2)");
    private static final Pattern FIRST_PERSON = p("\\b(i|i'm|i've|me|my|mine)\\b");
    private static final Pattern DOUBLE = p("\\b(twice|double|counted? (both|again)|both|also (logged|scanned|log)|and also|"
            + "separately|add (them|it) up|plus my meter|each of us logged|same (dinner|meal|trip|item))\\b");
    private static final Pattern SCENARIO = p("\\b(what if|carbon twin|scenario|simulat|over a (month|year)|per (month|year)|a year|"
            + "a month|annually|every (day|week|month)|each (day|week)|daily|weekly)\\b");
    private static final Pattern COMPARE = p("\\b(instead of|rather than|vs\\.?|versus|compared? (to|with)|switch(ing)?|replac(e|ing)|"
            + "better than|lower than|than (driving|taking|flying|eating))\\b|\\bor\\b.{0,40}\\?");
    private static final Pattern QUANTITY = p("\\d+(?:\\.\\d+)?\\s?(kwh|mwh|wh\\b|km\\b|kms\\b|kilomet|mi\\b|miles?\\b|g\\b|grams?|kg of|"
            + "litre|liter|hours? of)");
    private static final Pattern CONVERT = p("\\b(convert|how many (kg|kilograms|tonnes?|grams|kwh)|in kg|into (kg|tonnes?|t\\b)|"
            + "per (day|week|month|year) is|t/mwh|kg/kwh|g/km|tonnes? per year|kg per (day|week))");
    private static final Pattern TARGET = p("\\b(1\\.5|paris|target|budget|ipcc|science.?based|compatible footprint|aligned)\\b");
    private static final Pattern FACTOR = p("\\b(emission factor|grid factor|grid intensity|carbon intensity|kg co2e? per|per kwh|per km|"
            + "per passenger|how much co2e? (does|is|per)|factor (for|of))");
    private static final Pattern PERSONAL_DATA = p("\\b(my (footprint|emissions|logs?|week|month|history|dashboard|total|electricity|"
            + "travel|food|shopping|score|streak|biggest)|this week|last week|this month|last month|i logged|i've logged|i have logged)\\b");
    private static final Pattern TREND = p("\\b(go (up|down)|went (up|down)|up or down|trend|increas|decreas|compared to last|vs last|"
            + "better than last|worse than last)\\b");
    private static final Pattern RECOMMEND = p("\\b(how (can|do|should) i (reduce|cut|lower)|tips?|suggest|recommend|what should i (do|change)|"
            + "easiest action|biggest (win|lever)|where should i start)\\b");
    private static final Pattern EXPLAIN = p("\\b(why|explain|difference between|what is|what's|what are|same as|boundary|t&d|transmission|"
            + "scope [123]|lifecycle|life.?cycle|methodolog|outdated|old (factor|number|dashboard)|contradict|different (number|figure|value)|"
            + "which (source|number)|co2e|is it true|source)\\b");

    private CoachRouter() {}

    public static Route route(String question, boolean knowledgeAvailable) {
        String q = question == null ? "" : question.toLowerCase(Locale.ROOT);
        boolean firstPerson = FIRST_PERSON.matcher(q).find();
        boolean activity = p(ACTIVITY).matcher(q).find();
        List<Intent> intents = new ArrayList<>();
        Set<String> tools = new LinkedHashSet<>();
        List<String> rules = new ArrayList<>();

        if (OTHER_PEOPLE.matcher(q).find()) {
            intents.add(Intent.OTHER_PEOPLE);
            rules.add("The question involves other people's data. You can only see the signed-in user. Say you cannot access other "
                    + "people's data; for comparisons with others, say it is not estimated because no data about other people is available. "
                    + "Never guess or describe anyone else's activity.");
        }
        if (SAVINGS.matcher(q).find() && (firstPerson || q.contains("carbonexo"))) {
            intents.add(Intent.SAVINGS_CLAIM);
            tools.add(GetUserActivityHistoryTool.NAME);
            rules.add("A savings or verification claim. Check the user's logs first. Logged entries are estimates, not measured reductions: "
                    + "say the reduction is not measured or verified, and that a reduction needs a baseline. Green credits are in-app reward "
                    + "points, not carbon offsets. Never confirm, certify or write that the user saved, offset or neutralised emissions; "
                    + "decline requests to state that.");
        }
        if (DOUBLE.matcher(q).find() && (firstPerson || activity)) {
            intents.add(Intent.DOUBLE_COUNTING);
            tools.add(GetUserActivityHistoryTool.NAME);
            if (knowledgeAvailable) tools.add(RetrieveScientificKnowledgeTool.NAME);
            rules.add("A double-counting question. Each emission is counted once: a meter or bill total already includes the appliances "
                    + "behind it (appliance rows are attributions, not additions); log either the groceries or the meals made from them, "
                    + "not both; a delivery entry covers only the delivery leg and packaging, the food is logged separately; a shared car "
                    + "trip is divided by the people sharing it; EV charging is logged as electricity or as car km, not both; a product is "
                    + "counted at purchase and its disposal separately only for the disposal stage.");
        }
        boolean scenario = SCENARIO.matcher(q).find() && (COMPARE.matcher(q).find() || q.contains("twin"));
        if (scenario && activity) {
            intents.add(Intent.SCENARIO);
            tools.add(RunCarbonTwinScenarioTool.NAME);
        } else if (COMPARE.matcher(q).find() && activity && QUANTITY.matcher(q).find()) {
            intents.add(Intent.COMPARISON);
            tools.add(CalculateEmissionComparisonTool.NAME);
        } else if (QUANTITY.matcher(q).find() && activity) {
            intents.add(Intent.QUANTITY_ESTIMATE);
            tools.add(EstimateEmissionsTool.NAME);
        }
        if (intents.contains(Intent.SCENARIO) || intents.contains(Intent.COMPARISON)) {
            rules.add("A comparison or what-if. State the baseline, the alternative and the difference from the tool, call the difference "
                    + "hypothetical ('would'), never 'saved'. If a side is NOT_ESTIMATED, say 'Not estimated' and what is missing; do not "
                    + "give a partial difference.");
        }
        if (CONVERT.matcher(q).find()) {
            intents.add(Intent.UNIT_CONVERSION);
            tools.add(ConvertUnitsTool.NAME);
            rules.add("A unit conversion. Use convertUnits (and calculate for other arithmetic) and give the converted value with its unit.");
        }
        if (TARGET.matcher(q).find()) {
            intents.add(Intent.TARGET);
            tools.add(GetEmissionFactorsTool.NAME);
            rules.add("Targets: use getEmissionFactors with lifestyle_target_2030/_2040/_2050 (kg CO2e per person per year, whole lifestyle). "
                    + "For per-day or per-week figures use convertUnits. Logged partial tracking is not directly comparable with a "
                    + "whole-lifestyle target.");
        } else if (FACTOR.matcher(q).find()) {
            intents.add(Intent.FACTOR);
            tools.add(GetEmissionFactorsTool.NAME);
        }
        if (firstPerson && PERSONAL_DATA.matcher(q).find() && !intents.contains(Intent.OTHER_PEOPLE)) {
            if (TREND.matcher(q).find()) {
                intents.add(Intent.PERSONAL_TREND);
                tools.add(GetCarbonTrendsTool.NAME);
            } else {
                intents.add(Intent.PERSONAL);
                tools.add(GetUserActivityHistoryTool.NAME);
            }
        }
        if (RECOMMEND.matcher(q).find()) {
            intents.add(Intent.RECOMMENDATION);
            tools.add(GetPersonalizedRecommendationsTool.NAME);
        }
        if (knowledgeAvailable && EXPLAIN.matcher(q).find()) {
            intents.add(Intent.EXPLANATION);
            tools.add(RetrieveScientificKnowledgeTool.NAME);
            if (p("\\b(grid|electricity|kwh|t&d|transmission)\\b").matcher(q).find()) tools.add(GetEmissionFactorsTool.NAME);
        }
        if (intents.isEmpty()) intents.add(Intent.GENERAL);

        List<String> forced = tools.stream().limit(MAX_FORCED).toList();
        String contract = rules.isEmpty() ? "" : "\n\nQuestion type: " + intents.stream().map(Enum::name).toList()
                + ". Requirements for this answer:\n- " + String.join("\n- ", rules);
        return new Route(List.copyOf(intents), forced, contract);
    }

    private static Pattern p(String regex) {
        return Pattern.compile(regex, Pattern.CASE_INSENSITIVE);
    }
}
