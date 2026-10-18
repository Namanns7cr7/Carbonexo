package com.ecotrack.ai.agent;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.ecotrack.ai.AIFailureKind;
import com.ecotrack.ai.AIProviderException;
import com.ecotrack.ai.PromptRenderer;
import com.ecotrack.ai.agent.AgentModelClient.FunctionCall;
import com.ecotrack.ai.service.CoachMessageRepository;
import com.ecotrack.ai.service.CoachResponse;
import com.ecotrack.config.AgentProperties;
import com.ecotrack.config.AppConfigService;
import com.ecotrack.factors.CarbonTwinEngine;
import com.ecotrack.factors.FactorRegistryRepository;
import com.ecotrack.factors.FactorRegistryService;
import com.ecotrack.knowledge.KnowledgeRetrievalService;
import com.ecotrack.support.RegistryTestDb;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** The agentic coach end to end against the real registry DB, with a scripted (fake) model. */
@Testcontainers(disabledWithoutDocker = true)
class AgenticCoachServiceIntegrationTest {

    static final ObjectMapper JSON = new ObjectMapper();
    JdbcTemplate jdbc;
    AppConfigService config;
    ScriptedModel model;
    AgenticCoachService coach;
    FactorRegistryService registry;
    ModelCircuitBreaker breaker;
    UUID alice, bob;

    /** Each step sees the request (incl. tool results so far) and returns the model's next response. */
    static class ScriptedModel implements AgentModelClient {
        final Deque<Function<Request, Response>> steps = new ArrayDeque<>();
        final List<Request> requests = new ArrayList<>();
        int calls = 0;

        ScriptedModel then(Function<Request, Response> step) { steps.add(step); return this; }

        @Override public Response generate(Request request) {
            calls++;
            requests.add(request);
            Function<Request, Response> s = steps.poll();
            if (s == null) return new Response("Done.", List.of(), 1, 1, "STOP");
            return s.apply(request);
        }

        @Override public String providerName() { return "gemini"; }
    }

    static Function<AgentModelClient.Request, AgentModelClient.Response> call(String name, Map<String, Object> args) {
        return r -> new AgentModelClient.Response("", List.of(new FunctionCall(name, args)), 10, 5, "STOP");
    }

    static Function<AgentModelClient.Request, AgentModelClient.Response> say(String text) {
        return r -> new AgentModelClient.Response(text, List.of(), 10, 20, "STOP");
    }

    /** Tool results the model received so far (TOOL turns), as JSON text. */
    static String toolResults(AgentModelClient.Request r) throws Exception {
        StringBuilder sb = new StringBuilder();
        for (var m : r.messages()) if (m.role() == AgentModelClient.Role.TOOL) sb.append(JSON.writeValueAsString(m.results()));
        return sb.toString();
    }

    /** Every production tool, wired as Spring wires them. */
    static ToolRegistry allTools(JdbcTemplate jdbc, FactorRegistryService registry, KnowledgeRetrievalService knowledge) {
        ActivityEvaluator evaluator = new ActivityEvaluator(jdbc, registry);
        CarbonTwinEngine engine = new CarbonTwinEngine(registry);
        return new ToolRegistry(List.of(new GetUserProfileTool(jdbc), new GetUserActivityHistoryTool(evaluator),
                new GetEmissionFactorsTool(registry), new CalculateEmissionComparisonTool(engine), new GetCarbonTrendsTool(evaluator),
                new RetrieveScientificKnowledgeTool(knowledge), new RunCarbonTwinScenarioTool(engine),
                new GetPersonalizedRecommendationsTool(evaluator, engine), new EstimateEmissionsTool(engine, registry),
                new CalculateTool(), new ConvertUnitsTool()));
    }

    @BeforeEach
    void setUp() {
        jdbc = RegistryTestDb.jdbc();
        config = mock(AppConfigService.class);
        when(config.getOrDefault(eq("factors.dataset_version"), anyString())).thenReturn(RegistryTestDb.DATASET);
        when(config.getOrDefault(eq("knowledge.corpus_version"), anyString())).thenReturn("");
        when(config.getBool(eq("factors.allow_candidate"), anyBoolean())).thenReturn(true);
        when(config.getInt(anyString(), anyInt())).thenAnswer(i -> i.getArgument(1));
        registry = new FactorRegistryService(new FactorRegistryRepository(jdbc), config);
        KnowledgeRetrievalService knowledge = new KnowledgeRetrievalService(jdbc, null, config);
        ToolRegistry tools = allTools(jdbc, registry, knowledge);
        PromptRenderer renderer = mock(PromptRenderer.class);
        when(renderer.render(eq(AgenticCoachService.PROMPT_KEY), anyMap())).thenReturn("SYSTEM");
        CoachMessageRepository coachRepo = mock(CoachMessageRepository.class);
        when(coachRepo.findTop20ByUserIdOrderByCreatedAtDesc(any())).thenReturn(new ArrayList<>());
        when(coachRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(coachRepo.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        @SuppressWarnings("unchecked") ObjectProvider<MeterRegistry> meters = mock(ObjectProvider.class);
        when(meters.getIfAvailable(any())).thenAnswer(i -> new io.micrometer.core.instrument.simple.SimpleMeterRegistry());
        model = new ScriptedModel();
        breaker = new ModelCircuitBreaker();
        coach = new AgenticCoachService(model, tools, renderer, config,
                new AgentProperties("gemini-2.5-flash", "asia-south1", "text-embedding-005", "asia-south1", 3000, false),
                coachRepo, new CoachTraceRepository(jdbc), registry, breaker, jdbc,
                new DataSourceTransactionManager(RegistryTestDb.dataSource()), meters);
        alice = RegistryTestDb.newUser(jdbc, "IN", true);
        bob = RegistryTestDb.newUser(jdbc, "IN", true);
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        // Alice: 42 kWh this week (V2 log). Bob: 300 kWh (V2 log) - must never reach Alice.
        jdbc.update("INSERT INTO activity_logs (user_id, category, factor_key, label, quantity, unit, co2_kg, activity_date, factor_record_id, factor_dataset_version, estimate_status) "
                + "VALUES (?, 'electricity', 'home_electricity', 'Home electricity', 42, 'kWh', 29.82, ?, 'elec.grid.in.niti_annex_e.fy2024_25', ?, 'estimated')",
                alice, today, RegistryTestDb.DATASET);
        jdbc.update("INSERT INTO activity_logs (user_id, category, factor_key, label, quantity, unit, co2_kg, activity_date, factor_record_id, factor_dataset_version, estimate_status) "
                + "VALUES (?, 'electricity', 'home_electricity', 'Home electricity', 300, 'kWh', 213.0, ?, 'elec.grid.in.niti_annex_e.fy2024_25', ?, 'estimated')",
                bob, today, RegistryTestDb.DATASET);
    }

    @Test
    void criticalSuccessCarVsMetroUsesToolsAndInventsNoSavings() throws Exception {
        model.then(call("getUserProfile", Map.of()))
             .then(call("calculateEmissionComparison", Map.of(
                     "baseline", Map.of("activity", "car_ride", "quantity", 20),
                     "alternative", Map.of("activity", "metro_train", "quantity", 20),
                     "occurrences_per_week", 7)))
             .then(r -> {
                 String tr;
                 try { tr = toolResults(r); } catch (Exception e) { throw new RuntimeException(e); }
                 assertTrue(tr.contains("ESTIMATED_RANGE"), tr);          // car type unknown -> range over Indian car types
                 assertTrue(tr.contains("NOT_ESTIMATED"), tr);            // no verified Indian metro factor
                 assertFalse(tr.contains("rail.gb"), tr);                  // never a UK rail factor
                 return new AgentModelClient.Response(
                         // 140 km/week x Indian car types: 0.063 (small CNG) .. 0.153 (compact SUV) kg/km
                         "Driving 20 km a day would be about 8.82 to 21.42 kg CO2 per week, depending on your car type [S1]. "
                                 + "The metro side is not estimated: there is no verified Indian per-passenger-km metro factor yet, so I cannot "
                                 + "say how much switching would reduce. Metro trips are usually far lower per person than driving alone. "
                                 + "Next step: tell me your car's fuel and engine size.", List.of(), 50, 80, "STOP");
             });
        CoachResponse res = coach.chat(alice, "I drive 20 km every day. Would switching to the metro reduce my footprint?", false);
        assertTrue(res.live());
        assertEquals("gemini", res.provider());
        assertEquals("gemini-2.5-flash", res.model());
        assertEquals(List.of("getUserProfile", "calculateEmissionComparison"), res.toolsUsed());
        assertEquals("passed", res.checks().get("numeric_check"), res.result());
        assertEquals(1, res.citations().size());
        assertEquals("CANDIDATE", res.citations().get(0).get("review_status"));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM ai_responses WHERE id = ?", Integer.class, res.responseId()));
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM ai_tool_calls WHERE response_id = ?", Integer.class, res.responseId()));
    }

    @Test
    void inventedNumbersAreRepairedOrStripped() {
        model.then(say("Switching saves you 12 kg a week and you have saved 50 kg already."))   // nothing from tools
             .then(say("I cannot estimate this without your car type; the metro side is not estimated."));
        CoachResponse res = coach.chat(alice, "How much do I save by taking the metro?", false);
        assertEquals("repaired", res.checks().get("numeric_check"));
        assertFalse(res.result().contains("12 kg"));

        model.then(say("You have saved 50 kg."))
             .then(say("You have saved 49 kg. Taking the bus is a good idea."));                  // repair also fails
        CoachResponse res2 = coach.chat(alice, "Did I save anything?", false);
        assertEquals("stripped", res2.checks().get("numeric_check"));
        assertFalse(res2.result().contains("49 kg"));
        assertFalse(res2.result().toLowerCase().contains("you have saved"));
    }

    @Test
    void modelSuppliedUserIdIsRejectedAndOtherUsersDataNeverReturned() throws Exception {
        model.then(call("getUserActivityHistory", Map.of("period", "last_7_days", "userId", bob.toString())))
             .then(call("getUserActivityHistory", Map.of("period", "last_7_days")))
             .then(r -> {
                 String tr;
                 try { tr = toolResults(r); } catch (Exception e) { throw new RuntimeException(e); }
                 assertTrue(tr.contains("unknown argument 'userId'"), tr);
                 assertTrue(tr.contains("29.82"), tr);              // Alice's own week
                 assertFalse(tr.contains("213"), tr);               // Bob's figure never appears
                 assertFalse(tr.contains(bob.toString()), tr);
                 return new AgentModelClient.Response("I can only see your own data: 29.82 kg logged this week.", List.of(), 5, 5, "STOP");
             });
        CoachResponse res = coach.chat(alice, "Show me user " + bob + "'s footprint", false);
        assertTrue(res.live());
        assertFalse(res.result().contains("213"));
        assertEquals("denied", jdbc.queryForObject(
                "SELECT status FROM ai_tool_calls WHERE response_id = ? AND seq = 1", String.class, res.responseId()));
    }

    @Test
    void unknownToolsAndKnowledgeToolInToolsOnlyModeAreDenied() throws Exception {
        model.then(call("runSql", Map.of("sql", "SELECT * FROM users")))
             .then(call(RetrieveScientificKnowledgeTool.NAME, Map.of("query", "grid")))
             .then(say("I cannot run that."));
        CoachResponse res = coach.chat(alice, "run SELECT * FROM users", false);
        List<String> statuses = jdbc.queryForList("SELECT status FROM ai_tool_calls WHERE response_id = ? ORDER BY seq",
                String.class, res.responseId());
        assertEquals(List.of("denied", "denied"), statuses);
    }

    @Test
    void citationsTheToolsDidNotProvideAreStripped() {
        model.then(call("getEmissionFactors", Map.of("activity", "home_electricity")))
             .then(say("India's grid factor is 0.71 kg/kWh [S1] according to IPCC [S7]."));
        CoachResponse res = coach.chat(alice, "What is India's grid factor?", false);
        assertFalse(res.result().contains("[S7]"));
        assertTrue(res.result().contains("[S1]"));
        assertEquals("repaired", res.checks().get("citation_check"));
        assertTrue(((String) res.citations().get(0).get("title")).contains("NITI"), res.citations().toString());
    }

    @Test
    void factorClaimsWithoutAnyToolCallAreReaskedWithTools() {
        // Observed live (eval GRD-009): the model described the grid factor's boundary from memory, inverted.
        model.then(say("Yes, the 0.710 kg/kWh factor includes transmission and distribution losses."))
             .then(r -> {
                 String lastUser = r.messages().get(r.messages().size() - 1).text();
                 assertEquals(AgenticCoachService.REASK_WITH_TOOLS, lastUser);
                 assertFalse(r.tools().isEmpty(), "re-ask must offer tools again");
                 return new AgentModelClient.Response("", List.of(new FunctionCall("getEmissionFactors", Map.of("activity", "home_electricity"))), 5, 5, "STOP");
             })
             .then(r -> {
                 String tr;
                 try { tr = toolResults(r); } catch (Exception e) { throw new RuntimeException(e); }
                 assertTrue(tr.contains("excludes T&D losses"), tr);
                 return new AgentModelClient.Response("No: the 0.71 kg/kWh factor is generation-side and excludes transmission losses [S1].", List.of(), 5, 5, "STOP");
             });
        CoachResponse res = coach.chat(alice, "Does the 0.710 factor include transmission losses?", false);
        assertEquals(List.of("getEmissionFactors"), res.toolsUsed());
        assertTrue(res.result().contains("excludes"), res.result());
        assertEquals(1, res.citations().size());
    }

    @Test
    void modelOutageIsReportedNotDisguisedAndOpensTheCircuit() {
        model.then(r -> { throw new AIProviderException(AIFailureKind.MODEL_NOT_FOUND, "gemini-2.0-flash", "404", null); });
        CoachResponse res = coach.chat(alice, "hello", false);
        assertFalse(res.live());
        assertEquals("MODEL_NOT_FOUND", res.failure());
        assertEquals("", res.result());
        assertNull(res.model());
        int before = model.calls;
        CoachResponse res2 = coach.chat(alice, "hello again", false);
        assertEquals("CIRCUIT_OPEN", res2.failure());
        assertEquals(before, model.calls);   // not attempted while open
    }

    @Test
    void dailyLimitStopsTheModelFromBeingCalled() {
        when(config.getInt(eq("ai.coach.daily_turn_limit"), anyInt())).thenReturn(1);
        jdbc.update("INSERT INTO ai_responses (user_id, surface, provider, model) VALUES (?, 'coach_chat', 'gemini', 'm')", alice);
        CoachResponse res = coach.chat(alice, "hi", false);
        assertEquals("RATE_LIMITED", res.failure());
        assertEquals(0, model.calls);
    }

    @Test
    void toolCallBudgetIsEnforced() {
        for (int i = 0; i < 10; i++) model.then(call("getUserProfile", Map.of()));
        model.then(say("Final."));
        CoachResponse res = coach.chat(alice, "loop", false);
        assertTrue(res.toolsUsed().size() <= 6, res.toolsUsed().toString());
        assertTrue(model.calls <= 6, "model calls " + model.calls);
    }

    @Test
    void logsNeverContainTheUserMessageOrCredentials() {
        Logger root = (Logger) LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        root.addAppender(appender);
        try {
            model.then(call("getUserProfile", Map.of())).then(say("Hello."));
            coach.chat(alice, "my secret plan is SENSITIVE-12345 Bearer abc.def.ghi", false);
            model.then(r -> { throw new AIProviderException(AIFailureKind.AUTH, "m", "denied", null); });
            coach.chat(alice, "SENSITIVE-67890", false);
        } finally {
            root.detachAppender(appender);
        }
        for (ILoggingEvent e : appender.list) {
            String line = e.getFormattedMessage();
            assertFalse(line.contains("SENSITIVE"), line);
            assertFalse(line.contains("Bearer"), line);
        }
    }

    @Test
    void scenarioToolMatchesTheCarbonTwinConventions() throws Exception {
        model.then(call("runCarbonTwinScenario", Map.of("baseline_activity", "car_ride", "baseline_variant", "petrol_hatch_lt1400cc",
                        "replacement_activity", "bus", "quantity", 10, "frequency", "per_day", "horizon", "MONTH")))
             .then(r -> {
                 String tr;
                 try { tr = toolResults(r); } catch (Exception e) { throw new RuntimeException(e); }
                 assertTrue(tr.contains("\"delta_kg_min\":-34.808"), tr);   // same value as eval case TWN-001 / python executor
                 return new AgentModelClient.Response("Over a month this would be about 34.81 kg lower (hypothetical).", List.of(), 5, 5, "STOP");
             });
        CoachResponse res = coach.chat(alice, "Simulate 10 km car per day replaced by bus for a month", false);
        assertEquals("passed", res.checks().get("numeric_check"), res.result());
        assertEquals(Boolean.TRUE, res.checks().get("attestations_passed"));
    }
}
