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
        OTHER_PEOPLE, CREDIT_SCORE, GREEN_CREDITS, CREDIT_RULES, REWARDS_CATALOG, CARBON_CREDIT_CONCEPT,
        SAVINGS_CLAIM, DOUBLE_COUNTING, SCENARIO, COMPARISON, QUANTITY_ESTIMATE, UNIT_CONVERSION,
        TARGET, FACTOR, PERSONAL_TREND, PERSONAL, CATEGORY_BREAKDOWN, REPORT_EXPLANATION, COMMUNITY,
        BILLS_OCR, RECOMMENDATION, EXPLANATION, GENERAL
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
    // Carbonexo credits: the in-app balance, the 300-850 score and the earning/redeeming rules.
    private static final Pattern SCORE = p("\\b((carbon )?credit score|my score|the score|score (change|changed|drop|dropped|went|mean|work)|"
            + "improve (my |the )?score|raise (my |the )?score|explain (my |the )?score|score\\?)");
    private static final Pattern BALANCE = p("\\b(how (many|much) (green |carbonexo |reward )?(credits?|points)(?! score)|"
            + "my (green |carbonexo |reward )?(credits?|points)(?! score)|(credit|points) balance|"
            + "(green|carbonexo|reward) (credits?|points) (do|have) i)");
    private static final Pattern CREDIT_RULES = p("\\b((earn|get|gain|collect|win)( more)? (green |carbonexo |reward )?(credits?|points|rewards?)|"
            + "(redeem|spend|use|sell|trade|cash ?out|transfer)\\b.{0,30}\\b(credits?|points|them)|tradable|tradeable)\\b");
    private static final Pattern REWARDS_CAT = p("\\b((what|available|view|list|show|browse) (can i )?(redeem|rewards?)|rewards? (catalogue|catalog|items?|options?)|what (can i get|rewards can i redeem) with my credits|what rewards)\\b");
    private static final Pattern CREDIT_CONCEPT = p("\\b(carbon credits?|carbon offsets?|offsets?|offsetting|additionality|additional|"
            + "retire(d|ment)?|allowances?|cap.and.trade|carbon markets?|emissions? trading)\\b");
    private static final Pattern CARBONEXO_CREDITS = p("\\b(green|carbonexo|reward) (credits?|points)\\b");
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
    private static final Pattern CATEGORY_BREAKDOWN = p("\\b((biggest|largest) (source|impact|category|emission)|breakdown (of|by)? (my )?(category|emissions|footprint)|(food|shopping|waste|electricity|travel) (footprint|emissions|percentage|share))\\b");
    private static final Pattern REPORT = p("\\b(reports?|esg|sustainability report|csrd|brsr|export summary|download report)\\b");
    private static final Pattern COMMUNITY = p("\\b((my |joined )?(groups?|communit(y|ies)|household)|what groups am i in|who is in my group)\\b");
    private static final Pattern BILLS = p("\\b((my |uploaded )?bills?|electricity bills?|ocr( status)?|bill upload|units consumed|meter units)\\b");
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
        boolean score = SCORE.matcher(q).find() && !intents.contains(Intent.OTHER_PEOPLE);
        if (score) {
            intents.add(Intent.CREDIT_SCORE);
            tools.add(GetCarbonCreditScoreTool.NAME);
            rules.add("The Carbon Credit Score. Use getCarbonCreditScore: give the score, the 300-850 scale and the tier. For how to "
                    + "improve it, name only the components in can_still_improve with their rules. For why it changed, say score history "
                    + "is not stored and explain the current components. It is an in-app engagement score, not a financial credit score "
                    + "and not a rating of carbon credits. Do not call factor or emissions tools.");
        }
        if (BALANCE.matcher(q).find() && !score && !intents.contains(Intent.OTHER_PEOPLE)) {
            intents.add(Intent.GREEN_CREDITS);
            tools.add(GetGreenCreditBalanceTool.NAME);
            rules.add("The user's green-credit balance. Use getGreenCreditBalance and answer directly, for example 'You currently have "
                    + "N Carbonexo green credits.' Green credits are Carbonexo in-app reward points, not certified carbon credits. "
                    + "Do not call factor or emissions tools.");
        }
        if (REWARDS_CAT.matcher(q).find() && !intents.contains(Intent.OTHER_PEOPLE)) {
            intents.add(Intent.REWARDS_CATALOG);
            tools.add(GetRewardsCatalogTool.NAME);
            tools.add(GetGreenCreditBalanceTool.NAME);
            rules.add("Rewards catalogue. Use getRewardsCatalog and getGreenCreditBalance to describe the available rewards in the catalogue, "
                    + "their cost in credits, and whether the user currently has enough balance to redeem them.");
        } else if (CREDIT_RULES.matcher(q).find() && !intents.contains(Intent.OTHER_PEOPLE)) {
            intents.add(Intent.CREDIT_RULES);
            tools.add(GetGreenCreditRulesTool.NAME);
            rules.add("Earning or redeeming Carbonexo green credits. Use getGreenCreditRules. Mention only earning rules with "
                    + "awarded_by_app_today=true and say where in the app. Green credits can be redeemed only for items in the rewards "
                    + "catalogue on the Rewards page; they cannot be sold, traded, transferred or cashed out, and they are not carbon "
                    + "credits. Do not promise rewards or rules that are not in the tool result.");
        }
        if (CREDIT_CONCEPT.matcher(q).find() && !CARBONEXO_CREDITS.matcher(q).find() && !q.contains("my credit")) {
            intents.add(Intent.CARBON_CREDIT_CONCEPT);
            if (knowledgeAvailable) tools.add(RetrieveScientificKnowledgeTool.NAME);
            rules.add("A carbon-market concept question. Answer exactly what was asked in two to four plain sentences, from the "
                    + "retrieved Carbonexo guidance. A carbon credit represents a quantified emission reduction or removal, usually one "
                    + "tonne of CO2e, issued under a crediting programme; an allowance is a permit to emit under a cap-and-trade system; "
                    + "an offset is retiring credits to compensate for one's own emissions. If relevant, say Carbonexo green credits are "
                    + "in-app reward points, not carbon credits. Give more detail only if the user asks. Do not call factor or "
                    + "emissions tools.");
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
        if (firstPerson && PERSONAL_DATA.matcher(q).find() && !intents.contains(Intent.OTHER_PEOPLE) && !score) {
            if (TREND.matcher(q).find()) {
                intents.add(Intent.PERSONAL_TREND);
                tools.add(GetCarbonTrendsTool.NAME);
            } else {
                intents.add(Intent.PERSONAL);
                tools.add(GetUserActivityHistoryTool.NAME);
            }
        }
        if (CATEGORY_BREAKDOWN.matcher(q).find() && (firstPerson || PERSONAL_DATA.matcher(q).find())) {
            intents.add(Intent.CATEGORY_BREAKDOWN);
            tools.add(GetActivityCategoryBreakdownTool.NAME);
            rules.add("Footprint category breakdown. Use getActivityCategoryBreakdown: explain the emissions per category (travel, electricity, food, shopping, waste) using the exact numbers from the tool.");
        }
        if (REPORT.matcher(q).find() && !intents.contains(Intent.OTHER_PEOPLE)) {
            intents.add(Intent.REPORT_EXPLANATION);
            tools.add(GetEsgReportSummaryTool.NAME);
            rules.add("ESG and sustainability reports. Use getEsgReportSummary: provide the user's official metrics (lifetime saved kg, current month kg, category breakdown, credits earned, and logging streak). Do not invent ESG figures.");
        }
        if (COMMUNITY.matcher(q).find()) {
            intents.add(Intent.COMMUNITY);
            tools.add(GetUserGroupsTool.NAME);
            rules.add("Community and household groups. Use getUserGroups to list the signed-in user's joined groups, member counts, and roles. Say you cannot access private activity of individual other members.");
        }
        if (BILLS.matcher(q).find() && !intents.contains(Intent.OTHER_PEOPLE)) {
            intents.add(Intent.BILLS_OCR);
            tools.add(GetUserBillsTool.NAME);
            rules.add("Electricity bills and OCR uploads. Use getUserBills to report the user's uploaded bills, OCR status, units consumed (kWh), and billed amount.");
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
