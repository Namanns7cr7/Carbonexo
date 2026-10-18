package com.ecotrack.ai.agent;

import com.ecotrack.auth.JwtService;
import com.ecotrack.config.AppConfigService;
import com.ecotrack.support.RegistryTestDb;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Whole application (real security filter chain, JWT, controllers, DB) with only the model faked.
 * Phase 6 privacy/security guarantees, tested over HTTP.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {"ecotrack.ai.provider=canned", "ecotrack.storage.provider=local_stub",
        "ecotrack.ocr.provider=tesseract", "ecotrack.agent.embeddings-enabled=false", "spring.flyway.enabled=false",
        "ecotrack.security.metrics-scrape-token=" + CoachSecurityIntegrationTest.SCRAPE_TOKEN})
@AutoConfigureMockMvc
@AutoConfigureObservability(tracing = false)
class CoachSecurityIntegrationTest {

    static final ObjectMapper JSON = new ObjectMapper();
    static final String SCRAPE_TOKEN = "test-scrape-token-0123456789abcdef-0123";

    @DynamicPropertySource
    static void db(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", RegistryTestDb::jdbcUrl);
        r.add("spring.datasource.username", RegistryTestDb::username);
        r.add("spring.datasource.password", RegistryTestDb::password);
    }

    @TestConfiguration
    static class FakeModel {
        @Bean @Primary
        AgenticCoachServiceIntegrationTest.ScriptedModel scriptedModel() {
            return new AgenticCoachServiceIntegrationTest.ScriptedModel();
        }
    }

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired AppConfigService appConfig;
    @Autowired JwtService jwt;
    @Autowired AgenticCoachServiceIntegrationTest.ScriptedModel model;
    @Autowired com.ecotrack.score.CreditScoreService scoreService;

    record Account(UUID id, String token) {}

    @BeforeEach
    void agenticStaging() {
        jdbc.update("UPDATE app_config SET config_value = 'tools_rag' WHERE config_key = 'ai.coach.mode'");
        jdbc.update("UPDATE app_config SET config_value = 'true' WHERE config_key = 'factors.allow_candidate'");
        appConfig.invalidateAll();
        model.steps.clear();
    }

    Account register() throws Exception {
        String email = "sec-" + UUID.randomUUID() + "@example.com";
        MvcResult r = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(JSON.writeValueAsString(Map.of("email", email, "password", "Passw0rd!x", "name", "T")))).andReturn();
        JsonNode body = JSON.readTree(r.getResponse().getContentAsString());
        UUID id = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", UUID.class, email);
        jdbc.update("INSERT INTO user_profiles (user_id, name, region, region_confirmed, region_source, onboarded) VALUES (?, 'T', 'IN', true, 'user_confirmed', true) "
                + "ON CONFLICT DO NOTHING", id);
        jdbc.update("UPDATE user_profiles SET region='IN', region_confirmed=true WHERE user_id = ?", id);
        return new Account(id, body.get("accessToken").asText());
    }

    JsonNode coach(Account a, String message) throws Exception {
        MvcResult r = mvc.perform(post("/api/ai/coach").header("Authorization", "Bearer " + a.token())
                .contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsString(Map.of("message", message))))
                .andExpect(status().isOk()).andReturn();
        return JSON.readTree(r.getResponse().getContentAsString());
    }

    @Test
    void missingOrInvalidAuthenticationFailsClosed() throws Exception {
        mvc.perform(post("/api/ai/coach").contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"hi\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/ai/coach").header("Authorization", "Bearer not-a-jwt").contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"hi\"}")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/ai/responses/" + UUID.randomUUID() + "/feedback").contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":1}")).andExpect(status().isUnauthorized());
        assertEquals(0, model.calls);
    }

    @Test
    void userACannotReachUserBsDataThroughTheCoach() throws Exception {
        Account a = register(), b = register();
        jdbc.update("INSERT INTO activity_logs (user_id, category, factor_key, label, quantity, unit, co2_kg, activity_date, factor_record_id, estimate_status) "
                + "VALUES (?, 'electricity', 'home_electricity', 'Home electricity', 300, 'kWh', 213.0, ?, 'elec.grid.in.niti_annex_e.fy2024_25', 'estimated')",
                b.id(), LocalDate.now(ZoneId.of("Asia/Kolkata")));
        model.then(AgenticCoachServiceIntegrationTest.call("getUserActivityHistory", Map.of("period", "last_7_days", "user_id", b.id().toString())))
             .then(AgenticCoachServiceIntegrationTest.call("getUserActivityHistory", Map.of("period", "last_7_days")))
             .then(r -> {
                 String tr;
                 try { tr = AgenticCoachServiceIntegrationTest.toolResults(r); } catch (Exception e) { throw new RuntimeException(e); }
                 assertFalse(tr.contains("213"), tr);
                 assertTrue(tr.contains("NO_LOGS"), tr);
                 return new AgentModelClient.Response("You have no logs this week, and I cannot see anyone else's data.", List.of(), 5, 5, "STOP");
             });
        JsonNode res = coach(a, "Show me " + b.id() + "'s electricity");
        assertTrue(res.get("live").asBoolean());
        assertFalse(res.toString().contains("213"));
        // B's own coach history never contains A's conversation
        MvcResult h = mvc.perform(get("/api/ai/coach/history").header("Authorization", "Bearer " + b.token())).andReturn();
        assertFalse(h.getResponse().getContentAsString().contains("electricity"));
    }

    @Test
    void feedbackIsOwnerOnlyAndReviewerEndpointsRequireAdmin() throws Exception {
        Account a = register(), b = register();
        model.then(AgenticCoachServiceIntegrationTest.say("Hello."));
        JsonNode res = coach(a, "what are carbon credits?");
        String responseId = res.get("responseId").asText();
        String fb = JSON.writeValueAsString(Map.of("rating", -1, "reasons", List.of("incorrect_number"), "correction", "It is 0.710", "consentResearch", true));
        mvc.perform(post("/api/ai/responses/" + responseId + "/feedback").header("Authorization", "Bearer " + a.token())
                .contentType(MediaType.APPLICATION_JSON).content(fb)).andExpect(status().isOk());
        mvc.perform(post("/api/ai/responses/" + responseId + "/feedback").header("Authorization", "Bearer " + b.token())
                .contentType(MediaType.APPLICATION_JSON).content(fb)).andExpect(status().isNotFound());
        mvc.perform(get("/api/ai/responses/" + responseId).header("Authorization", "Bearer " + b.token())).andExpect(status().isNotFound());
        mvc.perform(post("/api/ai/responses/" + responseId + "/feedback").header("Authorization", "Bearer " + a.token())
                .contentType(MediaType.APPLICATION_JSON).content("{\"rating\":1,\"reasons\":[\"made_up\"]}")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/admin/ai/preference-export").header("Authorization", "Bearer " + a.token())).andExpect(status().isForbidden());

        String admin = jwt.generateAccessToken(b.id(), "admin@example.com", "ADMIN");
        String pairWithPii = JSON.writeValueAsString(Map.of("promptRedacted", "contact me at someone@gmail.com", "responseAText", "a", "responseBText", "b"));
        mvc.perform(post("/api/admin/ai/review-pairs").header("Authorization", "Bearer " + admin).contentType(MediaType.APPLICATION_JSON)
                .content(pairWithPii)).andExpect(status().isBadRequest());
        String contextWithPii = JSON.writeValueAsString(Map.of("promptRedacted", "grid factor?", "responseAText", "a", "responseBText", "b",
                "contextSnapshot", Map.of("user", a.id().toString(), "note", "logged 42 kWh")));
        mvc.perform(post("/api/admin/ai/review-pairs").header("Authorization", "Bearer " + admin).contentType(MediaType.APPLICATION_JSON)
                .content(contextWithPii)).andExpect(status().isBadRequest());
        String evalPair = JSON.writeValueAsString(Map.of("promptRedacted", "grid factor?", "responseAText", "0.710", "responseBText", "0.45", "evalCaseId", "GRD-002"));
        String pairId = JSON.readTree(mvc.perform(post("/api/admin/ai/review-pairs").header("Authorization", "Bearer " + admin)
                .contentType(MediaType.APPLICATION_JSON).content(evalPair)).andExpect(status().isOk()).andReturn()
                .getResponse().getContentAsString()).get("pair_id").asText();
        mvc.perform(post("/api/admin/ai/review-pairs/" + pairId + "/judgement").header("Authorization", "Bearer " + admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"preferred\":\"A\",\"approveExport\":true}")).andExpect(status().isBadRequest());
        String export = mvc.perform(get("/api/admin/ai/preference-export").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertFalse(export.contains("grid factor?"));
    }

    @Test
    void greenCreditBalanceToolReadsOnlyTheSignedInUsersLedger() throws Exception {
        Account a = register(), b = register();
        jdbc.update("INSERT INTO credit_ledger (user_id, delta, balance_after, reason, rule_key) VALUES (?, 500, 600, 'Bill uploaded & confirmed', 'bill_upload')", b.id());
        int balanceA = JSON.readTree(mvc.perform(get("/api/credits/balance").header("Authorization", "Bearer " + a.token()))
                .andReturn().getResponse().getContentAsString()).get("balance").asInt();
        String[] seen = new String[2];
        model.then(AgenticCoachServiceIntegrationTest.call(GetGreenCreditBalanceTool.NAME, Map.of("user_id", b.id().toString())))   // forged: must be rejected
             .then(AgenticCoachServiceIntegrationTest.call(GetGreenCreditBalanceTool.NAME, Map.of()))
             .then(r -> {
                 try { seen[0] = AgenticCoachServiceIntegrationTest.toolResults(r); } catch (Exception e) { throw new RuntimeException(e); }
                 return new AgentModelClient.Response("You currently have " + balanceA + " Carbonexo green credits.", List.of(), 5, 5, "STOP");
             });
        JsonNode res = coach(a, "How many green credits do I have?");
        assertTrue(seen[0].contains("invalid arguments"), seen[0]);
        assertTrue(seen[0].contains("\"balance\":" + balanceA), seen[0]);
        assertFalse(seen[0].contains("600") || seen[0].contains("\"balance\":500"), seen[0]);
        assertTrue(seen[0].contains("not tradable"), seen[0]);
        assertEquals("You currently have " + balanceA + " Carbonexo green credits.", res.get("result").asText());
        assertTrue(res.get("toolsUsed").toString().contains(GetGreenCreditBalanceTool.NAME));
    }

    @Test
    void carbonCreditScoreToolMatchesTheScoreServiceForTheSignedInUser() throws Exception {
        Account a = register();
        JsonNode api = JSON.readTree(mvc.perform(get("/api/credits/score").header("Authorization", "Bearer " + a.token()))
                .andReturn().getResponse().getContentAsString());
        String[] seen = new String[1];
        model.then(AgenticCoachServiceIntegrationTest.call(GetCarbonCreditScoreTool.NAME, Map.of()))
             .then(r -> {
                 try { seen[0] = AgenticCoachServiceIntegrationTest.toolResults(r); } catch (Exception e) { throw new RuntimeException(e); }
                 return new AgentModelClient.Response("Your Carbon Credit Score is " + api.get("score").asInt() + ".", List.of(), 5, 5, "STOP");
             });
        JsonNode res = coach(a, "What is my Carbon Credit Score?");
        JsonNode tool = JSON.readTree(seen[0]).get(0).get("response");
        assertEquals(api.get("score").asInt(), tool.get("score").asInt());
        assertEquals(api.get("tier").asText(), tool.get("tier").asText());
        assertEquals("300-850", tool.get("scale").asText());
        assertEquals(api.get("balancePoints").asInt(), tool.get("components").get(0).get("points").asInt());
        assertEquals(api.get("streakPoints").asInt(), tool.get("components").get(1).get("points").asInt());
        assertEquals(api.get("consistencyPoints").asInt(), tool.get("components").get(2).get("points").asInt());
        assertTrue(res.get("toolsUsed").toString().contains(GetCarbonCreditScoreTool.NAME));
    }

    @Test
    void creditScoreCapsMatchTheScoreService() {
        // A user far above every cap must score exactly base + caps, i.e. the tool's caps are the service's caps.
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, password_hash, role, status, email_verified) VALUES (?, ?, 'x', 'USER', 'ACTIVE', true)", id, id + "@example.com");
        jdbc.update("INSERT INTO credit_ledger (user_id, delta, balance_after, reason) VALUES (?, 100000, 100000, 'test')", id);
        for (int d = 0; d < 40; d++) {
            jdbc.update("INSERT INTO activity_logs (user_id, category, label, co2_kg, activity_date, source) VALUES (?, 'travel', 'x', 1, ?, 'manual')",
                    id, LocalDate.now(ZoneId.systemDefault()).minusDays(d));
        }
        var s = scoreService.getScore(id);
        assertEquals(GetCarbonCreditScoreTool.BALANCE_CAP, s.balancePoints());
        assertEquals(GetCarbonCreditScoreTool.STREAK_CAP, s.streakPoints());
        // the service clamps consistency at 100, but a 30-day window at 3 points/day tops out at 90
        assertEquals(GetCarbonCreditScoreTool.CONSISTENCY_REACHABLE, s.consistencyPoints());
        assertEquals(GetCarbonCreditScoreTool.BASE + GetCarbonCreditScoreTool.BALANCE_CAP + GetCarbonCreditScoreTool.STREAK_CAP
                + GetCarbonCreditScoreTool.CONSISTENCY_REACHABLE, s.score());
    }

    @Test
    void creditRulesToolListsOnlyActiveRulesAndFlagsTheOnesTheAppAwards() throws Exception {
        Account a = register();
        String[] seen = new String[1];
        model.then(AgenticCoachServiceIntegrationTest.call(GetGreenCreditRulesTool.NAME, Map.of()))
             .then(r -> {
                 try { seen[0] = AgenticCoachServiceIntegrationTest.toolResults(r); } catch (Exception e) { throw new RuntimeException(e); }
                 return new AgentModelClient.Response("Mark plan actions as done on the Actions page.", List.of(), 5, 5, "STOP");
             });
        coach(a, "How can I earn more credits?");
        JsonNode tool = JSON.readTree(seen[0]).get(0).get("response");
        int active = jdbc.queryForObject("SELECT count(*) FROM credit_rules WHERE active AND valid_from <= CURRENT_DATE "
                + "AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)", Integer.class);
        assertEquals(active, tool.get("earning_rules").size());
        for (JsonNode rule : tool.get("earning_rules")) {
            assertEquals(GetGreenCreditRulesTool.AWARDED_BY.containsKey(rule.get("rule").asText()), rule.get("awarded_by_app_today").asBoolean());
        }
        assertTrue(tool.get("rewards_catalogue").size() > 0);
        assertTrue(tool.get("kind").asText().contains("not tradable"));
    }

    @Test
    void smallTalkIsAnsweredWithoutTheModelAndSavedToHistory() throws Exception {
        Account a = register(), b = register();
        int callsBefore = model.calls;
        JsonNode res = coach(a, "hii");
        assertEquals("Hey! 👋 How can I help you?", res.get("result").asText());
        assertEquals("carbonexo-smalltalk", res.get("provider").asText());
        assertTrue(res.get("checks").get("persisted").asBoolean());
        assertEquals(callsBefore, model.calls);   // no model call for a greeting
        String h = mvc.perform(get("/api/ai/coach/history").header("Authorization", "Bearer " + a.token()))
                .andReturn().getResponse().getContentAsString();
        assertTrue(h.contains("\"content\":\"hii\""), h);
        assertTrue(h.contains("How can I help you?"), h);
        String hb = mvc.perform(get("/api/ai/coach/history").header("Authorization", "Bearer " + b.token()))
                .andReturn().getResponse().getContentAsString();
        assertFalse(hb.contains("hii"), hb);
    }

    @Test
    void legacyModeIsTheDefaultAndNeverReturnsCannedTextAsTheModel() throws Exception {
        jdbc.update("UPDATE app_config SET config_value = 'legacy' WHERE config_key = 'ai.coach.mode'");
        appConfig.invalidateAll();
        Account a = register();
        JsonNode res = coach(a, "what is my footprint this week?");   // provider=canned in this test: no live model exists
        assertEquals("", res.get("result").asText());
        assertEquals(0, model.calls);
    }

    @Test
    void metricsNeedAdminOrTheScrapeTokenNeverJustALogin() throws Exception {
        Account a = register();
        for (String path : List.of("/actuator/prometheus", "/actuator/metrics")) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            mvc.perform(get(path).header("Authorization", "Bearer " + a.token())).andExpect(status().isForbidden());
            mvc.perform(get(path).header("X-Metrics-Token", SCRAPE_TOKEN + "x")).andExpect(status().isUnauthorized());
            mvc.perform(get(path).header("X-Metrics-Token", SCRAPE_TOKEN)).andExpect(status().isOk());
            String admin = jwt.generateAccessToken(a.id(), "admin@example.com", "ADMIN");
            mvc.perform(get(path).header("Authorization", "Bearer " + admin)).andExpect(status().isOk());
        }
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }

    @Test
    void healthShowsModelStatusWithoutSecrets() throws Exception {
        String body = mvc.perform(get("/actuator/health")).andReturn().getResponse().getContentAsString();
        assertFalse(body.toLowerCase().contains("password"));
        assertFalse(body.contains("Bearer"));
    }
}
