package com.ecotrack.credit;

import com.ecotrack.support.RegistryTestDb;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * The credit economy over HTTP against a real Postgres: only catalogued actions earn credits,
 * each at most once, and concurrent redemptions can neither overspend a balance nor oversell stock.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {"ecotrack.ai.provider=canned", "ecotrack.storage.provider=local_stub",
        "ecotrack.ocr.provider=tesseract", "ecotrack.agent.embeddings-enabled=false", "spring.flyway.enabled=false"})
@AutoConfigureMockMvc
@AutoConfigureObservability(tracing = false)
class CreditEconomyIntegrationTest {

    static final ObjectMapper JSON = new ObjectMapper();
    static final int THREADS = 8;

    @DynamicPropertySource
    static void db(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", RegistryTestDb::jdbcUrl);
        r.add("spring.datasource.username", RegistryTestDb::username);
        r.add("spring.datasource.password", RegistryTestDb::password);
    }

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    record Account(UUID id, String token) {}

    Account register() throws Exception {
        String email = "credit-" + UUID.randomUUID() + "@example.com";
        MvcResult r = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(JSON.writeValueAsString(Map.of("email", email, "password", "Passw0rd!x", "name", "T")))).andReturn();
        JsonNode body = JSON.readTree(r.getResponse().getContentAsString());
        UUID id = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", UUID.class, email);
        return new Account(id, body.get("accessToken").asText());
    }

    int balance(Account a) {
        return jdbc.queryForObject("SELECT COALESCE(SUM(delta), 0) FROM credit_ledger WHERE user_id = ?", Integer.class, a.id());
    }

    int status(String url, Account a) throws Exception {
        return mvc.perform(post(url).header("Authorization", "Bearer " + a.token())).andReturn().getResponse().getStatus();
    }

    /** Fires the same request from THREADS threads at once and returns every HTTP status. */
    List<Integer> blast(String url, Account a) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        CountDownLatch go = new CountDownLatch(1);
        List<Future<Integer>> futures = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            futures.add(pool.submit(() -> { go.await(); return status(url, a); }));
        }
        go.countDown();
        List<Integer> codes = new ArrayList<>();
        for (Future<Integer> f : futures) codes.add(f.get());
        pool.shutdown();
        return codes;
    }

    @Test
    void unknownActionKeyEarnsNothing() throws Exception {
        Account a = register();
        int before = balance(a);

        assertEquals(400, status("/api/credits/action?actionKey=made-up-" + UUID.randomUUID(), a));
        assertEquals(400, status("/api/credits/action?actionKey=%20", a));

        assertEquals(before, balance(a));
    }

    @Test
    void catalogActionEarnsOnceEvenWhenRepeated() throws Exception {
        Account a = register();
        int before = balance(a);

        assertEquals(204, status("/api/credits/action?actionKey=metro-commute", a));
        assertEquals(204, status("/api/credits/action?actionKey=metro-commute", a));

        int earned = balance(a) - before;
        assertTrue(earned > 0, "the first completion must earn credits");
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM credit_ledger WHERE user_id = ? AND rule_key = 'action_done'", Integer.class, a.id()));
    }

    @Test
    void concurrentCompletionsOfOneActionAwardExactlyOnce() throws Exception {
        Account a = register();

        blast("/api/credits/action?actionKey=carpool", a);

        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM credit_ledger WHERE user_id = ? AND rule_key = 'action_done'", Integer.class, a.id()));
    }

    @Test
    void concurrentRedemptionsCannotOverspendTheBalance() throws Exception {
        Account a = register();
        int cost = balance(a) * 6 / 10 + 1; // affordable once, never twice
        UUID reward = jdbc.queryForObject(
                "INSERT INTO rewards (reward_key, title, cost_credits, stock) VALUES (?, 'Overspend probe', ?, NULL) RETURNING id",
                UUID.class, "probe-" + UUID.randomUUID(), cost);

        List<Integer> codes = blast("/api/rewards/" + reward + "/redeem", a);

        assertEquals(1, codes.stream().filter(c -> c < 300).count(), "codes: " + codes);
        assertTrue(balance(a) >= 0, "balance went negative: " + balance(a));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM redemptions WHERE user_id = ?", Integer.class, a.id()));
    }

    @Test
    void concurrentRedemptionsCannotOversellLimitedStock() throws Exception {
        Account first = register(), second = register();
        UUID reward = jdbc.queryForObject(
                "INSERT INTO rewards (reward_key, title, cost_credits, stock) VALUES (?, 'Last unit probe', 1, 1) RETURNING id",
                UUID.class, "last-" + UUID.randomUUID());

        // Two different users race for the single remaining unit.
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch go = new CountDownLatch(1);
        Future<Integer> f1 = pool.submit(() -> { go.await(); return status("/api/rewards/" + reward + "/redeem", first); });
        Future<Integer> f2 = pool.submit(() -> { go.await(); return status("/api/rewards/" + reward + "/redeem", second); });
        go.countDown();
        int c1 = f1.get(), c2 = f2.get();
        pool.shutdown();

        assertEquals(1, (c1 < 300 ? 1 : 0) + (c2 < 300 ? 1 : 0), "statuses: " + c1 + ", " + c2);
        assertEquals(0, jdbc.queryForObject("SELECT stock FROM rewards WHERE id = ?", Integer.class, reward));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM redemptions WHERE reward_id = ?", Integer.class, reward));
    }
}
