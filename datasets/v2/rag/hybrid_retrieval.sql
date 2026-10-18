-- Hybrid retrieval over sci_chunks: full-text (ts_rank_cd) + pgvector cosine, fused with
-- reciprocal-rank fusion, with the Carbonexo policy filters applied IN SQL (not after the fact).
-- Bind: :q text, :qvec vector(768), :region text, :now timestamptz, :k int
WITH params AS (
    SELECT websearch_to_tsquery('english', :q) AS tsq, (:qvec)::vector(768) AS qvec,
           :region::text AS region, (:now)::timestamptz AS now, (:k)::int AS k
),
eligible AS (
    SELECT c.* FROM sci_chunks c, params p
    WHERE c.corpus_version = (SELECT corpus_version FROM sci_corpus_versions WHERE status = 'active')
      AND c.okf_status <> 'deprecated'
      AND (c.stale_after IS NULL OR p.now < c.stale_after)
      AND (c.role = 'internal_guidance' OR c.trust_tier <> 'unverified')
      AND (c.region IN (p.region, 'GLOBAL', 'ANY')            -- GB/US never reach an IN query (Decision 1)
           OR (p.region IS NULL))
),
lex AS (
    SELECT id, row_number() OVER (ORDER BY ts_rank_cd(tsv, p.tsq) DESC) AS r
    FROM eligible, params p WHERE tsv @@ p.tsq ORDER BY r LIMIT 50
),
vec AS (
    SELECT id, row_number() OVER (ORDER BY embedding <=> p.qvec) AS r
    FROM eligible, params p ORDER BY embedding <=> p.qvec LIMIT 50
),
fused AS (
    SELECT id, sum(1.0 / (60 + r)) AS rrf FROM (SELECT * FROM lex UNION ALL SELECT * FROM vec) u GROUP BY id
)
SELECT c.okf_concept_id, c.heading_path, c.role, c.trust_tier, c.okf_status, c.region,
       c.registry_pointer, c.citations, c.content, f.rrf
FROM fused f JOIN sci_chunks c USING (id)
ORDER BY f.rrf DESC
LIMIT (SELECT k FROM params);
