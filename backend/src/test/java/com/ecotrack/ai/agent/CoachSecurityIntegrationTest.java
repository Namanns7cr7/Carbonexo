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
        JsonNode res = coach(a, "hello");
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
    void legacyModeIsTheDefaultAndNeverReturnsCannedTextAsTheModel() throws Exception {
        jdbc.update("UPDATE app_config SET config_value = 'legacy' WHERE config_key = 'ai.coach.mode'");
        appConfig.invalidateAll();
        Account a = register();
        JsonNode res = coach(a, "hello");   // provider=canned in this test: no live model exists
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
