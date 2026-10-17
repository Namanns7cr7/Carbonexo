package com.ecotrack.ai.memory;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Objects;
import java.util.OptionalInt;
import java.util.UUID;

/**
 * JDBC access to {@code ai_memory} (pgvector). Plain JDBC rather than JPA so the
 * {@code vector} type needs no Hibernate extension. Every read and write is
 * scoped to a single, mandatory {@code user_id}: there is deliberately no
 * cross-user query.
 */
@Repository
public class AiMemoryRepository {

    static final String SOURCE_COACH_EXCHANGE = "coach_exchange";

    private final JdbcTemplate jdbc;

    public AiMemoryRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Size of the {@code ai_memory.embedding} column, or empty when the table does
     * not exist (pgvector unavailable, V10 was a no-op).
     */
    public OptionalInt embeddingColumnDimensions() {
        List<Integer> rows = jdbc.queryForList("""
                SELECT a.atttypmod FROM pg_attribute a
                WHERE a.attrelid = to_regclass('public.ai_memory') AND a.attname = 'embedding' AND NOT a.attisdropped
                """, Integer.class);
        return rows.isEmpty() ? OptionalInt.empty() : OptionalInt.of(rows.get(0));
    }

    public void insert(UUID userId, UUID sourceId, String content, float[] embedding, String model) {
        Objects.requireNonNull(userId, "userId");
        jdbc.update("""
                INSERT INTO ai_memory (user_id, source_type, source_id, content, embedding, embedding_model)
                VALUES (?, ?, ?, ?, ?::vector, ?)
                ON CONFLICT (user_id, source_type, source_id) DO NOTHING
                """, userId, SOURCE_COACH_EXCHANGE, sourceId, content, toVectorLiteral(embedding), model);
    }

    /** Cheap pre-check so users without older memories skip the embedding call. */
    public boolean hasMemories(UUID userId, String model, Instant createdBefore) {
        Objects.requireNonNull(userId, "userId");
        String sql = "SELECT EXISTS (SELECT 1 FROM ai_memory WHERE user_id = ? AND embedding_model = ?"
                + (createdBefore != null ? " AND created_at < ?" : "") + ")";
        Object[] args = createdBefore != null
                ? new Object[]{userId, model, utc(createdBefore)}
                : new Object[]{userId, model};
        return Boolean.TRUE.equals(jdbc.queryForObject(sql, Boolean.class, args));
    }

    /**
     * Nearest memories for one user by cosine distance, most similar first.
     * Exact search on the per-user b-tree; see database/benchmarks/ai_memory_hnsw.md
     * for why there is no HNSW index.
     */
    public List<MemoryHit> findSimilar(UUID userId, String model, float[] query, Instant createdBefore,
                                       int limit, double minSimilarity) {
        Objects.requireNonNull(userId, "userId");
        String vector = toVectorLiteral(query);
        String sql = """
                SELECT content, created_at, similarity FROM (
                    SELECT content, created_at, 1 - (embedding <=> ?::vector) AS similarity
                    FROM ai_memory
                    WHERE user_id = ? AND embedding_model = ?%s
                    ORDER BY embedding <=> ?::vector
                    LIMIT ?
                ) nearest
                WHERE similarity >= ?
                ORDER BY similarity DESC
                """.formatted(createdBefore != null ? " AND created_at < ?" : "");
        Object[] args = createdBefore != null
                ? new Object[]{vector, userId, model, utc(createdBefore), vector, limit, minSimilarity}
                : new Object[]{vector, userId, model, vector, limit, minSimilarity};
        return jdbc.query(sql, (rs, i) -> new MemoryHit(
                rs.getString("content"),
                rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                rs.getDouble("similarity")), args);
    }

    static String toVectorLiteral(float[] v) {
        StringBuilder sb = new StringBuilder(v.length * 10).append('[');
        for (int i = 0; i < v.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(v[i]);
        }
        return sb.append(']').toString();
    }

    private static OffsetDateTime utc(Instant instant) {
        return instant.atOffset(ZoneOffset.UTC);
    }
}
