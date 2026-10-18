package com.ecotrack.ai.agent;

import com.ecotrack.ai.AIFailureKind;
import com.ecotrack.ai.AIProviderException;
import com.ecotrack.ai.PromptRenderer;
import com.ecotrack.ai.agent.AgentModelClient.FunctionCall;
import com.ecotrack.ai.agent.AgentModelClient.FunctionResult;
import com.ecotrack.ai.agent.AgentModelClient.Message;
import com.ecotrack.ai.service.CoachMessage;
import com.ecotrack.ai.service.CoachMessageRepository;
import com.ecotrack.ai.service.CoachResponse;
import com.ecotrack.config.AgentProperties;
import com.ecotrack.config.AppConfigService;
import com.ecotrack.exception.BadRequestException;
import com.ecotrack.factors.FactorRegistryService;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * The agentic, source-grounded AI Coach (app_config ai.coach.mode = tools | tools_rag | safe_limited).
 *
 * <p>{@code safe_limited} is the conservative mode for production fallback: only APPROVED factor
 * datasets and human-reviewed evidence may supply numbers, an answer that fails verification is
 * stripped (no model repair), and model, quota or tool failures are reported to the user in plain
 * words under provider {@code carbonexo-safe} (never as Gemini).
 *
 * <p>Flow: rate limit and circuit check, then authorised context (principal only), then a bounded
 * tool loop (max iterations / tool calls / deadline), then deterministic verification (numbers must
 * come from tools; no "saved" for hypotheticals), one constrained repair, citation filtering, and
 * finally persistence of the answer and an audit trace (ai_responses, ai_tool_calls).
 *
 * <p>It never returns canned text as an answer. On model failure it returns an empty result with
 * {@code live=false} and the failure kind; the client then shows its labelled offline library.
 * User message text and tokens are never logged.
 */
@Service
public class AgenticCoachService {

    private static final Logger log = LoggerFactory.getLogger(AgenticCoachService.class);
    static final String PROMPT_KEY = "coach_agent_system";
    private static final int MAX_MESSAGE_CHARS = 2000;
    private static final int HISTORY_MESSAGES = 6;
    static final String SAFE_PROVIDER = "carbonexo-safe";
    private static final com.fasterxml.jackson.databind.ObjectMapper JSON = new com.fasterxml.jackson.databind.ObjectMapper();

    public enum Mode {
        TOOLS("tools"), TOOLS_RAG("tools_rag"), SAFE_LIMITED("safe_limited");
        final String key;
        Mode(String key) { this.key = key; }
        public static Mode fromConfig(String v) {
            for (Mode m : values()) if (m.key.equals(v)) return m;
            return null;
        }
        boolean knowledge() { return this != TOOLS; }
        boolean safe() { return this == SAFE_LIMITED; }
    }

    private final AgentModelClient model;
    private final ToolRegistry tools;
    private final PromptRenderer renderer;
    private final AppConfigService config;
    private final AgentProperties agentProps;
    private final CoachMessageRepository coachRepo;
    private final CoachTraceRepository traces;
    private final FactorRegistryService registry;
    private final ModelCircuitBreaker breaker;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final MeterRegistry meters;
    private final Clock clock;

    public AgenticCoachService(AgentModelClient model, ToolRegistry tools, PromptRenderer renderer, AppConfigService config,
                               AgentProperties agentProps, CoachMessageRepository coachRepo, CoachTraceRepository traces,
                               FactorRegistryService registry, ModelCircuitBreaker breaker, JdbcTemplate jdbc,
                               PlatformTransactionManager txManager, ObjectProvider<MeterRegistry> meters) {
        this.model = model;
        this.tools = tools;
        this.renderer = renderer;
        this.config = config;
        this.agentProps = agentProps;
        this.coachRepo = coachRepo;
        this.traces = traces;
        this.registry = registry;
        this.breaker = breaker;
        this.jdbc = jdbc;
        this.tx = new TransactionTemplate(txManager);
        this.meters = meters.getIfAvailable(SimpleMeterRegistry::new);
        this.clock = Clock.systemUTC();
    }

    public CoachResponse chat(UUID userId, String userMessage, boolean includeKnowledge) {
        return chat(userId, userMessage, includeKnowledge ? Mode.TOOLS_RAG : Mode.TOOLS);
    }

    public CoachResponse chat(UUID userId, String userMessage, Mode coachMode) {
        return chat(userId, userMessage, coachMode, null);
    }

    /**
     * @param pageHint where the user is in the app ("Green Credits (/app/credits)"), already validated by the
     *                 controller; a low-priority hint that never replaces the latest message. Null when absent.
     */
    public CoachResponse chat(UUID userId, String userMessage, Mode coachMode, String pageHint) {
        if (userId == null) throw new IllegalStateException("authenticated user required");
        if (userMessage == null || userMessage.isBlank()) throw new BadRequestException("message is required");
        if (userMessage.length() > MAX_MESSAGE_CHARS) throw new BadRequestException("message too long");
        long t0 = System.nanoTime();
        String mode = coachMode.key;
        boolean includeKnowledge = coachMode.knowledge();
        boolean safe = coachMode.safe();

        int limit = config.getInt("ai.coach.daily_turn_limit", 50);
        if (traces.countSince(userId, clock.instant().minus(Duration.ofHours(24))) >= limit) {
            count("rate_limited", mode);
            return notLive(AIFailureKind.RATE_LIMITED, "You have reached today's coach limit (" + limit
                    + " messages). It resets within 24 hours.");
        }
        if (breaker.isOpen()) {
            count("circuit_open", mode);
            return notLive(AIFailureKind.CIRCUIT_OPEN, safe ? safeFailureText(AIFailureKind.CIRCUIT_OPEN) : "");
        }

        Map<String, Object> profile = profile(userId);
        String region = (String) profile.getOrDefault("region", "GLOBAL");
        boolean confirmed = Boolean.TRUE.equals(profile.get("region_confirmed"));
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        ToolContext ctx = new ToolContext(userId, region, confirmed, today, new SourceLedger(), safe, new GroundedNumbers());
        ctx.numbers().addText(userMessage);
        CoachRouter.Route route = config.getBool("ai.coach.router_enabled", true)
                ? CoachRouter.route(userMessage, includeKnowledge) : new CoachRouter.Route(List.of(), List.of(), "");
        String system = renderer.render(PROMPT_KEY, Map.of("region", region + (confirmed ? "" : " (not confirmed by the user)"),
                "today", today.toString())) + route.contract() + (safe ? SAFE_RULES : "")
                + (pageHint == null ? "" : "\n\nThe user is currently viewing the " + pageHint + " page. Use this only when the "
                        + "latest message refers to this page or is ambiguous; the latest message is always the question to answer.");

        List<Message> messages = history(userId);
        messages.add(Message.user(userMessage));
        List<AgentModelClient.ToolSpec> specs = tools.tools(includeKnowledge).stream()
                .map(t -> new AgentModelClient.ToolSpec(t.name(), t.description(), t.parametersJson())).toList();

        int maxIter = config.getInt("ai.coach.max_iterations", 4);
        int maxCalls = config.getInt("ai.coach.max_tool_calls", 6);
        int maxOut = config.getInt("ai.coach.max_output_tokens", 4096);
        Duration deadline = Duration.ofMillis(config.getInt("ai.coach.turn_deadline_ms", 25000));
        Instant until = clock.instant().plus(deadline);

        TurnState st = new TurnState(messages);
        Set<String> available = specs.stream().map(AgentModelClient.ToolSpec::name).collect(Collectors.toSet());
        st.required = route.requiredTools().stream().filter(available::contains).toList();
        try {
            runToolLoop(st, ctx, system, specs, includeKnowledge, maxIter, maxCalls, maxOut, until);
            // Grounding re-ask: the model stated factor-like claims without consulting any tool
            // (observed: a grid factor described as including T&D losses, the opposite of its boundary).
            if (st.executions.isEmpty() && st.answer != null && AnswerVerifier.makesFactorClaims(st.answer)) {
                meters.counter("carbonexo.coach.verifier", "result", "reask_no_tools").increment();
                st.messages.add(Message.model(st.answer, List.of()));
                st.messages.add(Message.user(REASK_WITH_TOOLS));
                st.answer = null;
                runToolLoop(st, ctx, system, specs, includeKnowledge, 3, maxCalls, maxOut, clock.instant().plus(Duration.ofSeconds(15)));
            }
            breaker.recordSuccess();
        } catch (AIProviderException e) {
            breaker.recordFailure(e.kind());
            count("model_failure_" + e.kind(), mode);
            log.warn("Agentic coach: no live answer (kind={}, toolCalls={})", e.kind(), st.executions.size());
            return notLive(e.kind(), safe ? safeFailureText(e.kind()) : "");
        }
        List<ToolRegistry.Execution> executions = st.executions;
        List<Map<String, Object>> results = st.results;
        int inTok = st.inTok, outTok = st.outTok;
        String answer = st.answer;

        // ---- verification and constrained repair (safe mode: strip only, no second model call) ----
        String numericCheck = "passed";
        List<Map<String, Object>> evidence = safe ? reviewedEvidenceOnly(results) : results;
        AnswerVerifier.Verdict v = AnswerVerifier.verify(answer, evidence, userMessage);
        if (!v.ok() && safe) {
            answer = AnswerVerifier.stripUngrounded(answer, v);
            numericCheck = "stripped";
            meters.counter("carbonexo.coach.verifier", "result", numericCheck).increment();
        } else if (!v.ok()) {
            try {
                AgentModelClient.Response r = model.generate(new AgentModelClient.Request(agentProps.model(), system,
                        withUser(withModel(messages, answer), repairInstruction(v)), List.of(), maxOut, Duration.ofSeconds(12)));
                inTok += r.inputTokens();
                outTok += r.outputTokens();
                String repaired = r.text();
                AnswerVerifier.Verdict v2 = AnswerVerifier.verify(repaired, results, userMessage);
                if (v2.ok()) {
                    answer = repaired;
                    numericCheck = "repaired";
                } else {
                    answer = AnswerVerifier.stripUngrounded(repaired, v2);
                    numericCheck = "stripped";
                }
            } catch (AIProviderException e) {
                answer = AnswerVerifier.stripUngrounded(answer, v);
                numericCheck = "stripped";
            }
            meters.counter("carbonexo.coach.verifier", "result", numericCheck).increment();
        }
        String citationCheck = "passed";
        answer = SourceLedger.normalize(answer);
        String cleaned = ctx.sources().stripUnknownMarkers(answer);
        if (!cleaned.equals(answer)) citationCheck = "repaired";
        answer = cleaned.isBlank() ? "I could not produce a verified answer to that. Please try rephrasing." : cleaned;
        List<SourceLedger.Source> cited = ctx.sources().cited(answer);
        // Deterministic additions after verification: the arithmetic exactly as the tools computed it,
        // and (safe mode) a plain statement of any data that could not be loaded.
        String calc = CalculationSummary.render(results, registry.datasetVersion(),
                registry.authority(safe).orElse(null) == com.ecotrack.factors.FactorLookup.Authority.CANDIDATE);
        if (!calc.isEmpty()) answer = answer + "\n\n" + calc;
        if (safe) {
            String failures = executions.stream().filter(x -> "timeout".equals(x.status()) || "error".equals(x.status()))
                    .map(x -> x.tool() + " (" + x.status() + ")").distinct().collect(Collectors.joining(", "));
            if (!failures.isEmpty()) answer = answer + "\n\nNote: some data could not be loaded (" + failures
                    + "), so this answer may be incomplete. Nothing was estimated for the missing part.";
        }

        // ---- attestations of every computed number ----
        List<Map<String, Object>> attestations = new ArrayList<>();
        for (Map<String, Object> r : results) collectReceipts(r, attestations);

        long latency = (System.nanoTime() - t0) / 1_000_000;
        String finalAnswer = answer;
        int fIn = inTok, fOut = outTok;
        String confidence = results.stream().map(r -> r.get("confidence")).filter(c -> c != null).map(Object::toString)
                .findFirst().orElse(includeKnowledge ? "not_used" : "disabled");
        String digest = results.stream().map(r -> r.get("_bundle_digest")).filter(c -> c != null).map(Object::toString).findFirst().orElse(null);
        String corpus = results.stream().map(r -> r.get("corpus_version")).filter(c -> c != null).map(Object::toString).findFirst().orElse(null);
        String nc = numericCheck, cc = citationCheck;
        UUID responseId = tx.execute(s -> persist(userId, userMessage, finalAnswer, executions, cited, nc, cc, confidence,
                corpus, digest, fIn, fOut, latency, attestations));

        count("answered", mode);
        meters.timer("carbonexo.coach.latency", "mode", mode).record(Duration.ofMillis(latency));
        meters.counter("carbonexo.coach.tokens", "direction", "input").increment(fIn);
        meters.counter("carbonexo.coach.tokens", "direction", "output").increment(fOut);
        log.info("Agentic coach answered response={} tools={} numeric={} citations={} latencyMs={}",
                responseId, executions.size(), numericCheck, cited.size(), latency);

        Map<String, Object> checks = new LinkedHashMap<>();
        checks.put("mode", mode);
        checks.put("route", route.intents().stream().map(Enum::name).toList());
        checks.put("numeric_check", numericCheck);
        checks.put("citation_check", citationCheck);
        checks.put("retrieval_confidence", confidence);
        checks.put("factor_dataset_version", registry.datasetVersion());
        checks.put("factor_authority", registry.authority(safe).map(Enum::name).orElse("NONE"));
        checks.put("attestations_passed", attestations.stream().allMatch(a -> Boolean.TRUE.equals(a.get("passed"))));
        checks.put("input_tokens", fIn);
        checks.put("output_tokens", fOut);
        checks.put("latency_ms", latency);
        return new CoachResponse(finalAnswer, null, model.providerName(), agentProps.model(), true, null, responseId,
                cited.stream().map(AgenticCoachService::citationJson).toList(),
                executions.stream().map(ToolRegistry.Execution::tool).toList(), checks);
    }

    static final String SAFE_RULES = "\n\nSafe mode: only factors with authority APPROVED, the user's own data, and passages labelled "
            + "'reviewed evidence' may supply numbers. Other passages may explain concepts, but do not state their numbers. When a tool "
            + "returns NOT_ESTIMATED, say 'Not estimated' and what is missing. General advice without numbers is fine.";

    static final String REASK_WITH_TOOLS = "Before answering, verify every factor value and its boundary with getEmissionFactors "
            + "(and retrieveScientificKnowledge for explanations if available). Then answer using only those tool results.";

    /** Mutable state of one coach turn's tool loop. */
    private static final class TurnState {
        final List<Message> messages;
        final List<ToolRegistry.Execution> executions = new ArrayList<>();
        final List<Map<String, Object>> results = new ArrayList<>();
        List<String> required = List.of();
        int inTok, outTok;
        String answer;

        TurnState(List<Message> messages) { this.messages = messages; }
    }

    private void runToolLoop(TurnState st, ToolContext ctx, String system, List<AgentModelClient.ToolSpec> specs,
                             boolean includeKnowledge, int maxIter, int maxCalls, int maxOut, Instant until) {
        for (int i = 0; i < maxIter && st.answer == null; i++) {
            Duration left = Duration.between(clock.instant(), until);
            if (left.isNegative() || left.isZero()) break;
            boolean lastRound = i == maxIter - 1 || st.executions.size() >= maxCalls;
            // Required-tool contract: until each routed tool has run, the model must call one of them.
            Set<String> done = st.executions.stream().map(ToolRegistry.Execution::tool).collect(Collectors.toSet());
            List<String> force = lastRound ? List.of() : st.required.stream().filter(t -> !done.contains(t)).toList();
            AgentModelClient.Response r = model.generate(new AgentModelClient.Request(agentProps.model(), system, st.messages,
                    lastRound ? List.of() : specs, maxOut, left, force));
            st.inTok += r.inputTokens();
            st.outTok += r.outputTokens();
            if (r.calls().isEmpty()) {
                st.answer = r.text();
                return;
            }
            st.messages.add(Message.model(r.text(), r.calls()));
            List<FunctionResult> fr = new ArrayList<>();
            for (FunctionCall call : r.calls()) {
                Map<String, Object> out;
                if (st.executions.size() >= maxCalls) {
                    out = Map.of("error", "tool call limit reached for this message; answer with what you have");
                } else {
                    ToolRegistry.Execution ex = tools.execute(ctx, call.name(), call.args(), includeKnowledge);
                    st.executions.add(ex);
                    meters.counter("carbonexo.coach.tool.calls", "tool", call.name(), "status", ex.status()).increment();
                    out = ex.result();
                    st.results.add(out);
                    try {
                        ctx.numbers().addText(JSON.writeValueAsString(out));
                    } catch (Exception ignored) {
                        // an unserialisable result contributes no operands
                    }
                }
                fr.add(new FunctionResult(call.name(), out));
            }
            st.messages.add(Message.tools(fr));
        }
        if (st.answer == null) {   // iterations/deadline exhausted: ask for a final answer without tools
            AgentModelClient.Response r = model.generate(new AgentModelClient.Request(agentProps.model(), system,
                    withUser(st.messages, "Answer now using only the tool results above. Say what could not be estimated."),
                    List.of(), maxOut, Duration.ofSeconds(10)));
            st.inTok += r.inputTokens();
            st.outTok += r.outputTokens();
            st.answer = r.text();
        }
    }

    private UUID persist(UUID userId, String userMessage, String answer, List<ToolRegistry.Execution> executions,
                         List<SourceLedger.Source> cited, String numericCheck, String citationCheck, String confidence,
                         String corpus, String digest, int inTok, int outTok, long latency, List<Map<String, Object>> attestations) {
        CoachMessage u = new CoachMessage();
        u.setUserId(userId);
        u.setRole("user");
        u.setContent(userMessage);
        coachRepo.save(u);
        CoachMessage a = new CoachMessage();
        a.setUserId(userId);
        a.setRole("assistant");
        a.setContent(answer);
        a.setProvider(model.providerName());
        a.setModel(agentProps.model());
        a.setTokens(inTok + outTok);
        a = coachRepo.saveAndFlush(a);   // the trace below references this row: it must exist before the JDBC insert
        List<Map<String, Object>> knowledge = new ArrayList<>();
        for (var ex : executions) {
            if (RetrieveScientificKnowledgeTool.NAME.equals(ex.tool()) && ex.result().get("passages") instanceof List<?> ps) {
                for (Object p : ps) if (p instanceof Map<?, ?> pm) knowledge.add(Map.of("concept", String.valueOf(pm.get("concept")),
                        "section", String.valueOf(pm.get("section")), "label", String.valueOf(pm.get("label"))));
            }
        }
        UUID id = traces.insertResponse(new CoachTraceRepository.Trace(userId, a.getId(), model.providerName(), agentProps.model(),
                PROMPT_KEY, 1, registry.datasetVersion(), corpus, digest, retrievalConfidence(confidence),
                cited.stream().map(AgenticCoachService::citationJson).toList(), citationCheck, numericCheck, false,
                inTok, outTok, latency, knowledge, attestations));
        int seq = 0;
        for (var ex : executions) {
            traces.insertToolCall(id, ++seq, ex.tool(), ex.args(), Map.of("status", String.valueOf(ex.result().getOrDefault("status", ex.status()))),
                    ex.status(), ex.latencyMs());
        }
        return id;
    }

    private void collectReceipts(Object node, List<Map<String, Object>> out) {
        if (node instanceof Map<?, ?> m) {
            if (m.get("receipt") instanceof Map<?, ?> rc) {
                @SuppressWarnings("unchecked") Map<String, Object> receipt = (Map<String, Object>) rc;
                out.add(Map.of("factor_id", String.valueOf(receipt.get("factor_id")), "result_kg", String.valueOf(receipt.get("result_kg")),
                        "passed", registry.attest(receipt)));
            }
            m.values().forEach(v -> collectReceipts(v, out));
        } else if (node instanceof List<?> l) {
            l.forEach(v -> collectReceipts(v, out));
        }
    }

    private List<Message> history(UUID userId) {
        List<CoachMessage> recent = new ArrayList<>(coachRepo.findTop20ByUserIdOrderByCreatedAtDesc(userId));
        Collections.reverse(recent);
        List<Message> out = new ArrayList<>();
        for (CoachMessage m : recent.subList(Math.max(0, recent.size() - HISTORY_MESSAGES), recent.size())) {
            if (m.getContent() == null || m.getContent().isBlank()) continue;
            out.add("assistant".equals(m.getRole()) ? Message.model(m.getContent(), List.of()) : Message.user(m.getContent()));
        }
        // Gemini requires the first turn to be a user turn
        while (!out.isEmpty() && out.get(0).role() != AgentModelClient.Role.USER) out.remove(0);
        return out;
    }

    private Map<String, Object> profile(UUID userId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT region, region_confirmed FROM user_profiles WHERE user_id = ? AND deleted_at IS NULL", userId);
        return rows.isEmpty() ? Map.of("region", "GLOBAL", "region_confirmed", false) : rows.get(0);
    }

    private static String repairInstruction(AnswerVerifier.Verdict v) {
        StringBuilder sb = new StringBuilder("Rewrite your previous answer. ");
        if (!v.ungroundedNumbers().isEmpty()) {
            sb.append("These figures are not in any tool result and must be removed or replaced by tool figures: ")
              .append(String.join("; ", v.ungroundedNumbers())).append(". ");
        }
        if (v.savedLanguage()) {
            sb.append("Do not say the user saved or avoided anything: comparisons and scenarios are hypothetical (use 'would'). ");
        }
        sb.append("Say 'not estimated' where a number is unavailable. Keep the [S#] citations. Output only the rewritten answer.");
        return sb.toString();
    }

    private static List<Message> withUser(List<Message> base, String text) {
        List<Message> l = new ArrayList<>(base);
        l.add(Message.user(text));
        return l;
    }

    private static List<Message> withModel(List<Message> base, String text) {
        List<Message> l = new ArrayList<>(base);
        l.add(Message.model(text, List.of()));
        return l;
    }

    private static String retrievalConfidence(String c) {
        return List.of("high", "medium", "low", "none").contains(c) ? c : null;
    }

    private static Map<String, Object> citationJson(SourceLedger.Source s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("marker", s.marker());
        m.put("kind", s.kind());
        m.put("source_id", s.sourceId());
        m.put("title", s.title());
        m.put("resource", s.resource());
        m.put("locator", s.locator());
        m.put("review_status", s.reviewStatus());
        return m;
    }

    private CoachResponse notLive(AIFailureKind kind, String text) {
        String provider = text.isEmpty() ? null : kind == AIFailureKind.RATE_LIMITED ? "carbonexo" : SAFE_PROVIDER;
        return new CoachResponse(text, null, provider, null, false, kind.name(), null, List.of(), List.of(), Map.of());
    }

    /** Plain-language failure for safe mode: what happened, that nothing was estimated, and what still works. */
    static String safeFailureText(AIFailureKind kind) {
        String reason = switch (kind) {
            case QUOTA, RATE_LIMITED -> "the AI service is at its usage limit";
            case TIMEOUT -> "the AI service took too long to respond";
            case CIRCUIT_OPEN, UNAVAILABLE -> "the AI service is temporarily unavailable";
            case BLOCKED -> "the AI service declined to answer this message";
            default -> "the AI service could not be reached";
        };
        return "The coach could not answer right now because " + reason + ". Nothing was estimated, and your logged "
                + "activities and totals are unaffected. Please try again in a few minutes. (Status: " + kind.name() + ")";
    }

    /** Safe mode: knowledge passages count as numeric evidence only when a person has reviewed them. */
    static List<Map<String, Object>> reviewedEvidenceOnly(List<Map<String, Object>> results) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : results) {
            if (r.get("passages") instanceof List<?> ps) {
                Map<String, Object> copy = new LinkedHashMap<>(r);
                copy.put("passages", ps.stream().filter(x -> x instanceof Map<?, ?> pm && "reviewed evidence".equals(pm.get("label"))).toList());
                out.add(copy);
            } else {
                out.add(r);
            }
        }
        return out;
    }

    private void count(String outcome, String mode) {
        meters.counter("carbonexo.coach.turns", "outcome", outcome, "mode", mode).increment();
    }
}
