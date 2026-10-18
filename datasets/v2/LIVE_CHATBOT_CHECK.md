# Live Chatbot Check (2026-10-17)

## 1. Production status: the coach is not using Gemini

| Check | Result |
|---|---|
| `carbonexo-backend` health | UP (first request 24.6 s: cold start, min-instances 0) |
| `carbonexo-web` | HTTP 200 |
| Coach model in production | `gemini-2.0-flash`. `AI_FAST_MODEL` is unset, so the code default applies |
| Vertex response for that model (asia-south1 and us-central1) | **404 NOT_FOUND** |
| Recommendations / monthly report model | `gemini-2.5-pro` in asia-south1: **404 NOT_FOUND** |
| What users receive | `CannedFallbackProvider` keyword templates (e.g. "Your electricity usage is moderate… 15%"), **saved as provider `gemini`, model `gemini-2.0-flash`** |
| Production traffic, last 30 days | 13 request log entries, essentially health checks only |

Reproduced end to end with the real backend jar and production's AI settings against a local throwaway database: `NOT_FOUND`, then a canned reply. No production data was read or written beyond logs and service config.

## 2. Model availability for project `carbonexo` (Vertex, ADC credentials, no API key)

| Model | asia-south1 | us-central1 | global |
|---|---|---|---|
| gemini-2.0-flash | 404 | 404 | |
| gemini-2.5-flash | **OK** | **OK** | |
| gemini-2.5-pro | 404 | | |
| gemini-3-flash-preview | 404 | 404 | **OK** (preview) |
| gemini-3.1-pro-preview | 404 | 404 | **OK** (preview) |

The backend's Java Vertex SDK cannot reach the `global` endpoint as written. It requests `global-aiplatform.googleapis.com`, which returns UNIMPLEMENTED/404, so Gemini 3 needs a small `GeminiAIProvider` change (an explicit `aiplatform.googleapis.com` endpoint when location = global).

## 3. Same 172 questions, same prompt the coach builds today (no tools, no RAG)

| | gemini-2.5-flash (asia-south1) | gemini-3-flash-preview (global) |
|---|---|---|
| Errors | 0 | 0 |
| Full pass | 3.5% | 2.9% |
| Content-only pass | 12.2% | **20.4%** |
| Numeric accuracy | 15.8% | **31.6%** |
| Cases with prohibited claims | 13 | 12 |
| Cases with ungrounded numbers | **65** | 98 |
| Latency p50 / p95 | **3.9 s / 8.1 s** | 5.5 s / 10.5 s |
| Measured cost per message | **$0.0016** | $0.0018 |
| Thinking tokens (share of output) | 89% | 82% |

The backend itself on 2.5-flash (via `run_live_eval.py`) scored 13.4% content pass, which is consistent with the REST replica.

Reading: Gemini 3 Flash is noticeably better at the numbers and at Indian grid questions (8/15 vs 2/15). Neither model is safe without tools, because both invent factors. Gemini 3 also fabricated a named third person's footprint for a cross-user question (LEK-001). The structural fix is the tool and RAG layer (`RAG_INTEGRATION_PLAN.md`), not the model choice.

## 4. Budget: $50 per month

- Fixed infrastructure today: ≈ $10–15 (Cloud SQL db-f1-micro ≈ $9, plus small items).
- Coach at measured ≈ $0.0016–0.0018 per message now. With tools and RAG, assume ≈ $0.003. That leaves ≈ $35 for **≈ 11,000 coach messages per month** (≈ 550 users × 20 messages).
- About 85% of output cost is thinking tokens. Setting a thinking budget would cut AI cost substantially; measure the quality impact before relying on it.
- Optional: `min-instances=1` removes the 24 s cold start but adds an always-on instance cost. Check that in the calculator against the $50 cap.
- Set a $50 billing budget with alerts at 50 / 90 / 100%.

## 5. Recommended fix (needs your approval: it changes production)

Immediate, with no code change, same region:

```
gcloud run services update carbonexo-backend --region asia-south1 \
  --update-env-vars AI_FAST_MODEL=gemini-2.5-flash,AI_DEFAULT_MODEL=gemini-2.5-flash
```

Then the Gemini 3 path: patch `GeminiAIProvider` for the global endpoint, re-run the 172 cases, and switch once you accept preview status and global processing.
