-- 1) load
\timing on
INSERT INTO users (id, email, password_hash)
SELECT gen_random_uuid(), 'bench' || g || '@example.test', 'x' FROM generate_series(1, 2001) g;
CREATE TEMP TABLE bu AS SELECT id, row_number() OVER (ORDER BY email) rn FROM users WHERE email LIKE 'bench%';
INSERT INTO ai_memory (user_id, source_type, source_id, content, embedding, embedding_model)
SELECT bu.id, 'coach_exchange', gen_random_uuid(), 'memory', 
       (SELECT array_agg(random() - 0.5)::vector FROM generate_series(1, 768) WHERE m.i > 0),
       'text-embedding-005'
FROM bu
CROSS JOIN LATERAL generate_series(1, CASE WHEN bu.rn = 1 THEN 5000 ELSE 100 END) AS m(i);
ANALYZE ai_memory;
SELECT count(*), count(DISTINCT user_id), pg_size_pretty(pg_total_relation_size('ai_memory')) FROM ai_memory;

-- 2) exact vs HNSW (planner's choice)
\pset pager off
DROP TABLE IF EXISTS bench_q, bench_res; DROP INDEX IF EXISTS bench_hnsw;
SELECT count(*) heavy_rows FROM ai_memory GROUP BY user_id ORDER BY 1 DESC LIMIT 1;
SELECT count(DISTINCT embedding::text) AS distinct_vectors FROM (SELECT embedding FROM ai_memory LIMIT 1000) s;
-- fixed workload: 300 typical-user queries + 50 heavy-user queries
CREATE TABLE IF NOT EXISTS bench_q AS
SELECT row_number() OVER () qid, u.id user_id, u.heavy,
       (SELECT array_agg(random() - 0.5)::vector FROM generate_series(1, 768) WHERE g > 0) q
FROM (SELECT id, false heavy FROM users WHERE email LIKE 'bench%' AND id <> (SELECT user_id FROM ai_memory GROUP BY user_id ORDER BY count(*) DESC LIMIT 1) ORDER BY random() LIMIT 300) u
CROSS JOIN generate_series(1,1) g
UNION ALL
SELECT 1000 + g, (SELECT user_id FROM ai_memory GROUP BY user_id ORDER BY count(*) DESC LIMIT 1), true,
       (SELECT array_agg(random() - 0.5)::vector FROM generate_series(1, 768) WHERE g > 0)
FROM generate_series(1, 50) g;
CREATE TABLE IF NOT EXISTS bench_res (mode text, qid bigint, ms double precision, ids uuid[]);

CREATE OR REPLACE FUNCTION run_bench(p_mode text) RETURNS void AS $$
DECLARE r record; t0 timestamptz; res uuid[];
BEGIN
  FOR r IN SELECT * FROM bench_q ORDER BY qid LOOP
    t0 := clock_timestamp();
    SELECT array_agg(id) INTO res FROM (
      SELECT id FROM ai_memory
      WHERE user_id = r.user_id AND embedding_model = 'text-embedding-005'
      ORDER BY embedding <=> r.q LIMIT 5) s;
    INSERT INTO bench_res VALUES (p_mode, r.qid, extract(epoch FROM clock_timestamp() - t0) * 1000, res);
  END LOOP;
END $$ LANGUAGE plpgsql;

-- warm cache, then exact (no ANN index)
SELECT run_bench('warmup'); DELETE FROM bench_res WHERE mode = 'warmup';
SELECT run_bench('exact_btree');
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT id FROM ai_memory WHERE user_id = (SELECT user_id FROM bench_q WHERE qid=1) AND embedding_model='text-embedding-005' ORDER BY embedding <=> (SELECT q FROM bench_q WHERE qid=1) LIMIT 5;

\timing on
SET maintenance_work_mem = '1GB'; SET max_parallel_maintenance_workers = 0;
CREATE INDEX bench_hnsw ON ai_memory USING hnsw (embedding vector_cosine_ops);
\timing off
ANALYZE ai_memory;
SELECT pg_size_pretty(pg_relation_size('bench_hnsw')) AS hnsw_size;

SELECT run_bench('hnsw_default');
SET hnsw.iterative_scan = relaxed_order;
SELECT run_bench('hnsw_iterative');
EXPLAIN (ANALYZE, COSTS OFF) SELECT id FROM ai_memory WHERE user_id = (SELECT user_id FROM bench_q WHERE qid=1) AND embedding_model='text-embedding-005' ORDER BY embedding <=> (SELECT q FROM bench_q WHERE qid=1) LIMIT 5;

SELECT r.mode, q.heavy,
       round(avg(r.ms)::numeric, 2) avg_ms,
       round(percentile_cont(0.95) WITHIN GROUP (ORDER BY r.ms)::numeric, 2) p95_ms,
       round(avg(COALESCE(cardinality(ARRAY(SELECT unnest(r.ids) INTERSECT SELECT unnest(e.ids))), 0) / 5.0)::numeric, 3) recall_at_5,
       round(avg(COALESCE(cardinality(r.ids), 0))::numeric, 2) avg_rows
FROM bench_res r JOIN bench_q q USING (qid)
JOIN bench_res e ON e.qid = r.qid AND e.mode = 'exact_btree'
GROUP BY r.mode, q.heavy ORDER BY q.heavy, r.mode;

-- 3) forced HNSW path (session-local, rolled back)
\pset pager off
SET enable_bitmapscan = off; SET enable_seqscan = off; SET enable_sort = off;
BEGIN;
UPDATE pg_index SET indisvalid = false WHERE indexrelid IN ('ix_ai_memory_user_model'::regclass, 'uq_ai_memory_source'::regclass);
DELETE FROM bench_q WHERE qid NOT IN (SELECT qid FROM bench_q WHERE NOT heavy AND qid <= 60 UNION ALL SELECT qid FROM bench_q WHERE heavy AND qid <= 1020);
SET LOCAL hnsw.iterative_scan = off;           SELECT run_bench('hnsw_forced_default');
SET LOCAL hnsw.iterative_scan = relaxed_order; SELECT run_bench('hnsw_forced_iterative');
SELECT r.mode, q.heavy, count(*) n,
       round(avg(r.ms)::numeric, 2) avg_ms,
       round(percentile_cont(0.95) WITHIN GROUP (ORDER BY r.ms)::numeric, 2) p95_ms,
       round(avg(COALESCE(cardinality(ARRAY(SELECT unnest(r.ids) INTERSECT SELECT unnest(e.ids))), 0) / 5.0)::numeric, 3) recall_at_5,
       round(avg(COALESCE(cardinality(r.ids), 0))::numeric, 2) avg_rows
FROM bench_res r JOIN bench_q q USING (qid)
JOIN bench_res e ON e.qid = r.qid AND e.mode = 'exact_btree'
WHERE r.mode LIKE 'hnsw_forced%'
GROUP BY r.mode, q.heavy ORDER BY q.heavy, r.mode;
ROLLBACK;
