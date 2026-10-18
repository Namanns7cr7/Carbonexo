package com.ecotrack.knowledge;

import com.ecotrack.ai.memory.EmbeddingProvider;
import com.ecotrack.config.AppConfigService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Hybrid scientific retrieval over sci_chunks (V14): PostgreSQL full-text (ts_rank_cd) plus pgvector
 * cosine, fused by reciprocal rank, with the Carbonexo policy applied IN SQL:
 * active corpus only; not deprecated; not stale; evidence must be at least machine-confirmed;
 * region = user region, GLOBAL or ANY (so UK/US documents never reach an Indian query).
 * The tables hold no user data, and this service never touches user tables.
 * Numbers are not served from here: factor chunks carry a registry pointer instead of values.
 */
public class KnowledgeRetrievalService {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeRetrievalService.class);
    private static final ObjectMapper JSON = new ObjectMapper();

    public record Passage(String conceptId, String section, String role, String trustTier, String status, String region,
                          String registryPointer, List<Map<String, Object>> citations, String text, double score,
                          List<String> injectionFlags) {}

    public record Result(String confidence, String corpusVersion, String bundleDigest, boolean vectorUsed, List<Passage> passages) {}

    private final JdbcTemplate jdbc;
    private final EmbeddingProvider embeddings;   // nullable: lexical-only
    private final AppConfigService config;

    public KnowledgeRetrievalService(JdbcTemplate jdbc, EmbeddingProvider embeddings, AppConfigService config) {
        this.jdbc = jdbc;
        this.embeddings = embeddings;
        this.config = config;
    }

    public Optional<String> activeCorpus() {
        String configured = config.getOrDefault("knowledge.corpus_version", "");
        if (!configured.isBlank()) return Optional.of(configured);
        try {
            return jdbc.queryForList("SELECT corpus_version FROM sci_corpus_versions WHERE status = 'active'", String.class)
                    .stream().findFirst();
        } catch (DataAccessException e) {
            return Optional.empty();   // V14 skipped (no pgvector) or not migrated
        }
    }

    public Result retrieve(String query, String region, int k, Instant now) {
        Optional<String> corpus = activeCorpus();
        if (corpus.isEmpty() || query == null || query.isBlank()) {
            return new Result("none", corpus.orElse(null), null, false, List.of());
        }
        String vec = null;
        if (embeddings != null) {
            try {
                vec = toVector(embeddings.embed(query, EmbeddingProvider.Task.RETRIEVAL_QUERY));
            } catch (Exception e) {
                log.warn("Knowledge query embedding failed ({}); lexical-only retrieval", e.getClass().getSimpleName());
            }
        }
        String reg = region == null ? "ANY" : region;
        String sql = """
                WITH eligible AS (
                    SELECT c.* FROM sci_chunks c
                    WHERE c.corpus_version = ? AND c.okf_status <> 'deprecated'
                      AND (c.stale_after IS NULL OR ? < c.stale_after)
                      AND (c.role = 'internal_guidance' OR c.trust_tier <> 'unverified')
                      AND c.region IN (?, 'GLOBAL', 'ANY')
                ),
                lex AS (
                    SELECT id, row_number() OVER (ORDER BY ts_rank_cd(tsv, q) DESC) AS r
                    FROM eligible, websearch_to_tsquery('english', ?) q WHERE tsv @@ q
                    ORDER BY r LIMIT 50
                ),
                lex_or AS (
                    SELECT id, row_number() OVER (ORDER BY ts_rank_cd(tsv, q) DESC) AS r
                    FROM eligible, to_tsquery('english', ?) q WHERE tsv @@ q
                    ORDER BY r LIMIT 50
                ),
                vec AS (
                    SELECT id, row_number() OVER (ORDER BY embedding <=> ?::vector) AS r
                    FROM eligible WHERE ?::text IS NOT NULL AND embedding IS NOT NULL
                    ORDER BY embedding <=> ?::vector LIMIT 50
                ),
                fused AS (
                    SELECT id, sum(w / (60.0 + r)) AS rrf FROM (
                        SELECT id, r, 1.0 AS w FROM lex UNION ALL
                        SELECT id, r, 0.5 AS w FROM lex_or UNION ALL
                        SELECT id, r, 1.0 AS w FROM vec) u GROUP BY id
                )
                SELECT c.okf_concept_id, c.heading_path, c.role, c.trust_tier, c.okf_status, c.region, c.registry_pointer,
                       c.citations::text, c.content, f.rrf, d.bundle_digest
                FROM fused f JOIN sci_chunks c ON c.id = f.id JOIN sci_documents d ON d.id = c.document_id
                ORDER BY f.rrf DESC LIMIT ?""";
        List<Passage> out = new ArrayList<>();
        String[] digest = {null};
        jdbc.query(sql, rs -> {
            InjectionGuard.Sanitized s = InjectionGuard.sanitize(rs.getString("content"));
            digest[0] = rs.getString("bundle_digest");
            out.add(new Passage(rs.getString("okf_concept_id"), rs.getString("heading_path"), rs.getString("role"),
                    rs.getString("trust_tier"), rs.getString("okf_status"), rs.getString("region"), rs.getString("registry_pointer"),
                    parse(rs.getString("citations")), s.text(), rs.getDouble("rrf"), s.flags()));
        }, corpus.get(), Timestamp.from(now), reg, query, orQuery(query), vec, vec, vec, k);
        // one passage per concept, best first
        List<Passage> unique = new ArrayList<>();
        out.stream().collect(Collectors.groupingBy(Passage::conceptId, java.util.LinkedHashMap::new, Collectors.toList()))
                .values().forEach(list -> unique.add(list.get(0)));
        boolean evidence = unique.stream().anyMatch(p -> "evidence".equals(p.role()));
        String confidence = unique.isEmpty() ? "none" : evidence ? (unique.size() >= 2 ? "high" : "medium") : "low";
        return new Result(confidence, corpus.get(), digest[0], vec != null, unique);
    }

    /** OR-of-terms query so short natural questions still match ("grid factor india" -> grid | factor | india). */
    static String orQuery(String q) {
        String terms = Arrays.stream(q.toLowerCase().split("[^a-z0-9]+")).filter(t -> t.length() > 2).limit(12)
                .collect(Collectors.joining(" | "));
        return terms.isEmpty() ? "nothing" : terms;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> parse(String json) {
        try {
            return JSON.readValue(json == null ? "[]" : json, List.class);
        } catch (Exception e) {
            return List.of();
        }
    }

    static String toVector(float[] v) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < v.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(v[i]);
        }
        return sb.append(']').toString();
    }
}
