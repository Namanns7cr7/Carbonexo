package com.ecotrack.ai.feedback;

import com.ecotrack.exception.BadRequestException;
import com.ecotrack.exception.ResourceNotFoundException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Human feedback on coach answers (V15) and the reviewer workflow that turns consented feedback into
 * preferred/rejected pairs. Nothing here trains a model; export only produces a reviewed JSONL file.
 *
 * <ul>
 *   <li>Users may rate only their own responses (ownership is checked in SQL; others get 404).</li>
 *   <li>Only feedback with {@code consent_research = true} can feed a review pair.</li>
 *   <li>Pairs linked to an eval case can never be exported (DB constraint + check here).</li>
 *   <li>Prompts, texts and context snapshots in pairs must be redacted: emails, UUIDs and phone numbers are rejected.</li>
 * </ul>
 */
@Service
public class FeedbackService {

    public static final Set<String> REASONS = Set.of("incorrect_number", "wrong_citation", "missing_citation", "not_relevant",
            "unsafe_advice", "unsupported_claim", "ignored_my_data", "wrong_region", "too_long", "unclear", "helpful", "accurate",
            "well_sourced");
    private static final Pattern PII = Pattern.compile(
            "[\\w.+-]+@[\\w-]+\\.[\\w.]+|\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b|\\+?\\d[\\d -]{8,}\\d");
    private static final ObjectMapper JSON = new ObjectMapper();
    private final JdbcTemplate jdbc;

    public FeedbackService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record FeedbackRequest(Integer rating, List<String> reasons, String comment, String correction, Boolean consentResearch) {}

    public record JudgementRequest(String preferred, Map<String, Object> rubric, Boolean approveExport) {}

    public record PairRequest(String promptRedacted, Map<String, Object> contextSnapshot, UUID responseAId, UUID responseBId,
                              String responseAText, String responseBText, List<UUID> sourceFeedbackIds, String evalCaseId) {}

    @Transactional
    public Map<String, Object> submit(UUID userId, UUID responseId, FeedbackRequest req) {
        if (req == null || req.rating() == null || (req.rating() != 1 && req.rating() != -1)) {
            throw new BadRequestException("rating must be 1 or -1");
        }
        List<String> reasons = req.reasons() == null ? List.of() : req.reasons();
        for (String r : reasons) if (!REASONS.contains(r)) throw new BadRequestException("unknown reason: " + r);
        if (req.comment() != null && req.comment().length() > 1000) throw new BadRequestException("comment too long");
        if (req.correction() != null && req.correction().length() > 2000) throw new BadRequestException("correction too long");
        requireOwned(userId, responseId);
        UUID id = jdbc.queryForObject("""
                INSERT INTO ai_feedback (response_id, user_id, rating, reasons, comment, correction, consent_research)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (response_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, reasons = EXCLUDED.reasons,
                    comment = EXCLUDED.comment, correction = EXCLUDED.correction, consent_research = EXCLUDED.consent_research,
                    updated_at = now()
                RETURNING id""", UUID.class, responseId, userId, req.rating(), reasons.toArray(new String[0]),
                req.comment(), req.correction(), Boolean.TRUE.equals(req.consentResearch()));
        return Map.of("feedback_id", id, "response_id", responseId);
    }

    /** The caller's own response trace: which model, versions and checks produced it. */
    public Map<String, Object> responseMeta(UUID userId, UUID responseId) {
        requireOwned(userId, responseId);
        return jdbc.queryForMap("""
                SELECT id, provider, model, prompt_template_key, prompt_template_ver, factor_dataset_version, corpus_version,
                       okf_bundle_digest, retrieval_confidence, citation_check, numeric_check, input_tokens, output_tokens,
                       latency_ms, created_at
                FROM ai_responses WHERE id = ? AND user_id = ?""", responseId, userId);
    }

    // ---------------------------------------------------------------- reviewer workflow (ADMIN)

    @Transactional
    public UUID createPair(PairRequest req) {
        if (req.promptRedacted() == null || req.promptRedacted().isBlank()) throw new BadRequestException("promptRedacted is required");
        // The context snapshot is exported too, so it is checked like the texts (it can carry user data).
        if (PII.matcher(req.promptRedacted()).find() || PII.matcher(nullToEmpty(req.responseAText())).find()
                || PII.matcher(nullToEmpty(req.responseBText())).find() || PII.matcher(json(req.contextSnapshot())).find()) {
            throw new BadRequestException("pair text must be redacted (emails, ids and phone numbers are not allowed)");
        }
        List<UUID> fb = req.sourceFeedbackIds() == null ? List.of() : req.sourceFeedbackIds();
        for (UUID f : fb) {
            Boolean consent = jdbc.query("SELECT consent_research FROM ai_feedback WHERE id = ?", rs -> rs.next() ? rs.getBoolean(1) : null, f);
            if (!Boolean.TRUE.equals(consent)) throw new BadRequestException("feedback " + f + " has no research consent");
        }
        return jdbc.queryForObject("""
                INSERT INTO ai_review_pairs (prompt_redacted, context_snapshot, response_a_id, response_b_id, response_a_text,
                    response_b_text, source_feedback_ids, eval_case_id)
                VALUES (?, ?::jsonb, ?, ?, ?, ?, ?, ?) RETURNING id""", UUID.class, req.promptRedacted(),
                json(req.contextSnapshot()), req.responseAId(), req.responseBId(), req.responseAText(), req.responseBText(),
                fb.toArray(new UUID[0]), req.evalCaseId());
    }

    @Transactional
    public Map<String, Object> judge(UUID pairId, String reviewer, JudgementRequest req) {
        if (req.preferred() == null || !Set.of("A", "B", "=").contains(req.preferred())) {
            throw new BadRequestException("preferred must be A, B or =");
        }
        Map<String, Object> pair = jdbc.queryForList("SELECT eval_case_id FROM ai_review_pairs WHERE id = ?", pairId).stream()
                .findFirst().orElseThrow(() -> ResourceNotFoundException.of("Review pair", pairId));
        boolean export = Boolean.TRUE.equals(req.approveExport());
        if (export && (pair.get("eval_case_id") != null || "=".equals(req.preferred()))) {
            throw new BadRequestException("eval-linked or tied pairs cannot be approved for export");
        }
        jdbc.update("""
                UPDATE ai_review_pairs SET preferred = ?, rubric = ?::jsonb, reviewer = ?, reviewed_at = now(), export_status = ?
                WHERE id = ?""", req.preferred(), json(req.rubric()), reviewer, export ? "approved" : "held", pairId);
        return Map.of("pair_id", pairId, "export_status", export ? "approved" : "held");
    }

    /** JSONL of approved pairs ({prompt, chosen, rejected, rubric}); marks them exported. Eval-linked pairs excluded. */
    @Transactional
    public String exportPreferences() {
        StringBuilder sb = new StringBuilder();
        List<UUID> ids = new java.util.ArrayList<>();
        jdbc.query("""
                SELECT id, prompt_redacted, context_snapshot::text, response_a_text, response_b_text, preferred, rubric::text, reviewer
                FROM ai_review_pairs WHERE export_status = 'approved' AND eval_case_id IS NULL AND preferred IN ('A','B')
                ORDER BY reviewed_at""", rs -> {
            Map<String, Object> row = new LinkedHashMap<>();
            boolean aWins = "A".equals(rs.getString("preferred"));
            row.put("prompt", rs.getString("prompt_redacted"));
            row.put("context", rs.getString(3));
            row.put("chosen", aWins ? rs.getString("response_a_text") : rs.getString("response_b_text"));
            row.put("rejected", aWins ? rs.getString("response_b_text") : rs.getString("response_a_text"));
            row.put("rubric", rs.getString(7));
            row.put("reviewer", rs.getString("reviewer"));
            sb.append(json(row)).append('\n');
            ids.add(UUID.fromString(rs.getString("id")));
        });
        for (UUID id : ids) jdbc.update("UPDATE ai_review_pairs SET export_status = 'exported' WHERE id = ?", id);
        return sb.toString();
    }

    private void requireOwned(UUID userId, UUID responseId) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM ai_responses WHERE id = ? AND user_id = ?", Integer.class, responseId, userId);
        if (n == null || n == 0) throw ResourceNotFoundException.of("AI response", responseId);
    }

    private static String json(Object o) {
        try {
            return JSON.writeValueAsString(o == null ? Map.of() : o);
        } catch (JsonProcessingException e) {
            throw new BadRequestException("invalid JSON");
        }
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }
}
