package com.ecotrack.ai.agent;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/** Holds the coach tools and executes one call with validation, a timeout and an audit record. */
@Component
public class ToolRegistry {

    private static final Logger log = LoggerFactory.getLogger(ToolRegistry.class);
    private static final Duration TOOL_TIMEOUT = Duration.ofSeconds(4);

    public record Execution(String tool, Map<String, Object> args, String status, Map<String, Object> result, long latencyMs) {}

    private final Map<String, CoachTool> tools = new LinkedHashMap<>();
    private final ExecutorService pool = Executors.newFixedThreadPool(4, r -> {
        Thread t = new Thread(r, "coach-tool");
        t.setDaemon(true);
        return t;
    });

    public ToolRegistry(List<CoachTool> all) {
        all.forEach(t -> tools.put(t.name(), t));
    }

    public List<CoachTool> tools(boolean includeKnowledge) {
        return tools.values().stream().filter(t -> includeKnowledge || !t.name().equals(RetrieveScientificKnowledgeTool.NAME)).toList();
    }

    public Execution execute(ToolContext ctx, String name, Map<String, Object> args, boolean includeKnowledge) {
        long t0 = System.nanoTime();
        CoachTool tool = tools.get(name);
        if (tool == null || (!includeKnowledge && name.equals(RetrieveScientificKnowledgeTool.NAME))) {
            return new Execution(name, args, "denied", Map.of("error", "unknown tool '" + name + "'"), 0);
        }
        // The security context is captured by the caller; tools never read it themselves.
        CompletableFuture<Map<String, Object>> f = CompletableFuture.supplyAsync(() -> tool.execute(ctx, args == null ? Map.of() : args), pool);
        try {
            Map<String, Object> result = f.get(TOOL_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            Object st = result.get("status");
            String status = st != null && st.toString().startsWith("NOT_ESTIMATED") ? "not_estimated" : "ok";
            return new Execution(name, args, status, result, ms(t0));
        } catch (TimeoutException e) {
            f.cancel(true);
            return new Execution(name, args, "timeout", Map.of("error", "tool timed out"), ms(t0));
        } catch (Exception e) {
            Throwable c = e.getCause() != null ? e.getCause() : e;
            if (c instanceof ToolArgs.ToolArgumentException tae) {
                return new Execution(name, args, "denied", Map.of("error", "invalid arguments: " + tae.getMessage()), ms(t0));
            }
            log.warn("Tool {} failed: {}", name, c.getClass().getSimpleName());
            return new Execution(name, args, "error", Map.of("error", "tool failed"), ms(t0));
        }
    }

    private static long ms(long t0) {
        return (System.nanoTime() - t0) / 1_000_000;
    }
}
