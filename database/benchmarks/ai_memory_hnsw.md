# ai_memory: HNSW index benchmark

**Decision: no HNSW index on `ai_memory.embedding`.** The `(user_id, embedding_model, created_at)`
b-tree plus an exact cosine-distance sort is faster and returns exact results. Look at this again only
if a single user grows past roughly 50k memories (see "Revisit when").

## Query under test

Every read in `AiMemoryRepository.findSimilar` is scoped to one user:

```sql
SELECT ... FROM ai_memory
WHERE user_id = ? AND embedding_model = ?
ORDER BY embedding <=> ?::vector
LIMIT 5;
```

## Setup

- `pgvector/pgvector:pg16` (PostgreSQL 16, pgvector 0.8.7), Docker Desktop, default config.
- Migrations V1–V10 applied, then synthetic data from [`ai_memory_hnsw.sql`](ai_memory_hnsw.sql):
  2,000 users × 100 memories, plus 1 heavy user × 5,000, for 205,000 rows of `vector(768)` (869 MB).
- Workload: 300 queries for typical users and 50 for the heavy user. Each query uses a fixed random vector.
  Recall@5 is measured against the exact (b-tree) result.
- HNSW: `USING hnsw (embedding vector_cosine_ops)`, default `m=16, ef_construction=64, ef_search=40`.

## Results

| Path | User | avg ms | p95 ms | recall@5 | rows returned |
|---|---|---:|---:|---:|---:|
| b-tree + exact sort (no ANN index) | typical (100) | **0.68** | **0.95** | **1.000** | 5.00 |
| b-tree + exact sort (no ANN index) | heavy (5,000) | **30.4** | **36.2** | **1.000** | 5.00 |
| HNSW forced, default | typical | 13.8 | 33.2 | 0.000 | 0.00 |
| HNSW forced, `iterative_scan=relaxed_order` | typical | 139.2 | 225.7 | 0.107 | 4.75 |
| HNSW forced, default | heavy | 13.0 | 20.7 | 0.050 | 2.85 |
| HNSW forced, `iterative_scan=relaxed_order` | heavy | 12.7 | 19.9 | 0.120 | 5.00 |

Index cost: an 8 min 45 s build (serial, `maintenance_work_mem=1GB`) and **801 MB** on disk, about
the same size as the table.

With the HNSW index present, the planner **still chose the b-tree + sort plan** for every query.
The index only cost space and write amplification. Forcing it (by hiding the b-trees) made things worse:

- HNSW pulls `ef_search` (40) global nearest neighbours first and applies `user_id` afterwards. A user
  owns about 0.05% of the rows, so almost none of those candidates survive the filter, and typical users
  get an **empty** result.
- Iterative scans bring the row count back up, but they explore a large share of the graph and still
  return the wrong rows (recall 0.11).

Random vectors are a worst case for ANN recall. Real embeddings cluster more, but the filtering problem
does not depend on the data distribution.

## Revisit when

- p95 of the coach memory query goes over ~50 ms in production. Watch the
  `ecotrack.ai.memory.retrieval` timer.
- A single user holds more than ~50k memories (exact sort grows linearly, at about 6 µs per row).

At that point, consider per-user partitioning or a partial index for the heavy tenants before reaching
for a global HNSW index.
