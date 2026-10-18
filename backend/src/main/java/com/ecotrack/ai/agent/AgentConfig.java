package com.ecotrack.ai.agent;

import com.ecotrack.ai.AiStatusTracker;
import com.ecotrack.ai.memory.EmbeddingProvider;
import com.ecotrack.ai.memory.VertexEmbeddingProvider;
import com.ecotrack.config.AgentProperties;
import com.ecotrack.config.AppConfigService;
import com.ecotrack.config.AppProperties;
import com.ecotrack.knowledge.KnowledgeRetrievalService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
public class AgentConfig {

    private static final Logger log = LoggerFactory.getLogger(AgentConfig.class);

    @Bean
    @ConditionalOnMissingBean(AgentModelClient.class)
    public AgentModelClient agentModelClient(AppProperties props, AgentProperties agent, AiStatusTracker status) {
        String project = props.ai().gemini() == null ? null : props.ai().gemini().projectId();
        log.info("Agentic coach model={} location={} project={}", agent.model(), agent.location(), project);
        return new GeminiAgentModelClient(project, agent.location(), status);
    }

    @Bean
    public KnowledgeRetrievalService knowledgeRetrievalService(JdbcTemplate jdbc, AppConfigService config, AppProperties props,
                                                               AgentProperties agent) {
        EmbeddingProvider embeddings = null;
        String project = props.ai().gemini() == null ? null : props.ai().gemini().projectId();
        if (agent.embeddingsEnabled() && project != null && !project.isBlank() && "gemini".equalsIgnoreCase(props.ai().provider())) {
            try {
                embeddings = new VertexEmbeddingProvider(project, agent.embeddingLocation(), agent.embeddingModel(), 768,
                        agent.embeddingTimeoutMs());
            } catch (Exception e) {
                log.warn("Knowledge embeddings unavailable ({}); retrieval will be lexical-only", e.getClass().getSimpleName());
            }
        } else {
            log.info("Knowledge embeddings disabled; retrieval is lexical-only");
        }
        return new KnowledgeRetrievalService(jdbc, embeddings, config);
    }
}
