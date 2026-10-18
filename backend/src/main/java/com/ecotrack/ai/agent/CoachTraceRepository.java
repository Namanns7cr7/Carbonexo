package com.ecotrack.ai.agent;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Writes ai_responses / ai_tool_calls (V15). Reads are scoped to the owning user. */
@Repository
public class CoachTraceRepository {

    private static final ObjectMapper JSON = new ObjectMapper();
    private final JdbcTemplate jdbc;

    public CoachTraceRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record Trace(UUID userId, UUID coachMessageId, String provider, String model, String promptKey, int promptVersion,
                        String factorDatasetVersion, String corpusVersion, String bundleDigest, String retrievalConfidence,
                        List<?> citations, String citationCheck, String numericCheck, boolean abstained,
                        int inputTokens, int outputTokens, long latencyMs, List<?> knowledgeUsed, List<?> attestations) {}

    public UUID insertResponse(Trace t) {
        return jdbc.queryForObject("""
                INSERT INTO ai_responses (user_id, coach_message_id, surface, provider, model, prompt_template_key, prompt_template_ver,
                    factor_dataset_version, corpus_version, okf_bundle_digest, retrieval_confidence, citations, citation_check,
                    numeric_check, abstained, input_tokens, output_tokens, latency_ms, knowledge_used, attestations)
                VALUES (?, ?, 'coach_chat', ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb) RETURNING id""",
                UUID.class, t.userId(), t.coachMessageId(), t.provider(), t.model(), t.promptKey(), t.promptVersion(),
                t.factorDatasetVersion(), t.corpusVersion(), t.bundleDigest(), t.retrievalConfidence(), json(t.citations()),
                t.citationCheck(), t.numericCheck(), t.abstained(), t.inputTokens(), t.outputTokens(), (int) t.latencyMs(),
                json(t.knowledgeUsed()), json(t.attestations()));
    }

    public void insertToolCall(UUID responseId, int seq, String tool, Map<String, Object> args, Map<String, Object> summary,
                               String status, long latencyMs) {
        jdbc.update("""
                INSERT INTO ai_tool_calls (response_id, seq, tool_name, arguments, result_summary, status, latency_ms)
                VALUES (?, ?, ?, ?::jsonb, ?::jsonb, ?, ?)""", responseId, seq, tool, json(args), json(summary), status, (int) latencyMs);
    }

    public int countSince(UUID userId, Instant since) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM ai_responses WHERE user_id = ? AND created_at >= ?",
                Integer.class, userId, Timestamp.from(since));
        return n == null ? 0 : n;
    }

    /** The response, only if it belongs to {@code userId}. */
    public boolean ownedBy(UUID responseId, UUID userId) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM ai_responses WHERE id = ? AND user_id = ?", Integer.class, responseId, userId);
        return n != null && n > 0;
    }

    static String json(Object o) {
        try {
            return JSON.writeValueAsString(o == null ? List.of() : o);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }
}
