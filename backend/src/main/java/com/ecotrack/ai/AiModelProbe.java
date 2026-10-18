package com.ecotrack.ai;

import com.ecotrack.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Optional startup check (AI_PROBE_ON_STARTUP=true; on in staging): one tiny live call per
 * configured model, so a retired or unserved model id (the gemini-2.0-flash 404) is visible in the
 * logs and in /actuator/health within seconds of deploy instead of silently producing fallbacks.
 * Runs on a daemon thread after the application is ready, so readiness (and Cloud Run's startup
 * probe) never waits on Vertex AI: a Vertex outage or a 30 s timeout cannot fail a deploy.
 */
@Component
@ConditionalOnProperty(name = "ecotrack.ai-probe.enabled", havingValue = "true")
public class AiModelProbe {

    private static final Logger log = LoggerFactory.getLogger(AiModelProbe.class);

    private final AIProvider provider;
    private final AppProperties props;

    public AiModelProbe(AIProvider provider, AppProperties props) {
        this.provider = provider;
        this.props = props;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        start();
    }

    /** Returns at once; the probe calls happen on a background thread. */
    Thread start() {
        Thread t = new Thread(this::probe, "ai-model-probe");
        t.setDaemon(true);
        t.start();
        return t;
    }

    void probe() {
        Set<String> models = new LinkedHashSet<>();
        models.add(props.ai().fastModel());
        models.add(props.ai().defaultModel());
        for (String model : models) {
            try {
                AIResult r = provider.generateResult("Reply with the single word OK.", model);
                if (r.live()) {
                    log.info("AI probe OK model={} latencyMs={}", model, r.latencyMs());
                } else {
                    log.error("AI probe FAILED model={} kind={} — coach will not use this model", model, r.failure());
                }
            } catch (Exception e) {
                log.error("AI probe FAILED model={} kind={}", model, AIFailureKind.classify(e));
            }
        }
    }
}
