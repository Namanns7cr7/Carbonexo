# Carbonexo EcoMind: Human Feedback & Review Pipeline

**Pipeline Status:** OPERATIONAL & TESTED  
**Backend Package:** `com.ecotrack.ai.feedback`  
**Database Tables:** `ai_responses`, `ai_feedback`, `ai_review_pairs`  

---

## 1. Feedback Collection Architecture

User feedback is collected directly from the chat interface after each AI response.

### Feedback Endpoint:
`POST /api/ai/responses/{responseId}/feedback`

### Payload Schema (`FeedbackRequest`):
```json
{
  "rating": 1, 
  "reasons": ["accurate", "well_sourced"],
  "comment": "The India grid factor citation (CEA v21.0) was very clear.",
  "correction": null,
  "consentResearch": true
}
```

### Supported Reason Codes:
- **Positive:** `helpful`, `accurate`, `well_sourced`
- **Factual & Scientific Errors:** `incorrect_number`, `wrong_citation`, `missing_citation`, `unsupported_claim`
- **Relevance & Scoping:** `not_relevant`, `ignored_my_data`, `wrong_region`
- **Safety & Clarity:** `unsafe_advice`, `too_long`, `unclear`

### Security & Authorization Enforcements:
- **Ownership Verification:** Users may only submit feedback on their own responses. The SQL check `SELECT count(*) FROM ai_responses WHERE id = ? AND user_id = ?` ensures cross-user feedback spoofing returns `404 Not Found`.
- **Consent Gate:** Only feedback items with `consent_research = true` can be promoted to candidate review pairs.

---

## 2. Reviewer Workflow (`ADMIN`)

To ensure feedback leads to genuine quality improvements without relying blindly on user ratings, the pipeline includes an explicit human reviewer stage.

### Workflow Steps:
1. **Pair Creation (`POST /api/admin/ai/review-pairs`):**
   - Ingests Response A and Response B (e.g., baseline vs candidate prompt, or live reply vs human correction).
   - Enforces PII scrubbing on prompts and context snapshots.
   - Attaches `sourceFeedbackIds` and verifies research consent.
2. **Human Expert Judgement (`POST /api/admin/ai/review-pairs/{pairId}/judgement`):**
   - Reviewer evaluates factual correctness, numerical precision, and groundedness.
   - Submits verdict: `A` (Response A preferred), `B` (Response B preferred), or `=` (Tie).
   - Supplies a structured review rubric and optional export approval.
   - **Tied or eval-linked pairs are strictly blocked from export.**

---

## 3. Preference Export for Post-Training

### Export Endpoint:
`GET /api/admin/ai/preference-export`  
**Content-Type:** `application/x-ndjson` (JSONL)

### Sample Output Record:
```json
{
  "prompt": "What grid emission factor should I use for India?",
  "context": "{\"region\":\"IN\"}",
  "chosen": "According to the CEA CO2 Baseline Database v21.0 and NITI Aayog (2026), the grid emission factor for India is 0.710 kg CO2/kWh.",
  "rejected": "You should use 0.45 kg CO2/kWh from DEFRA for electricity.",
  "rubric": "{\"factual_accuracy\": 5, \"citation_quality\": 5}",
  "reviewer": "human:climate_engineer_01"
}
```

### Contamination Guardrail:
The query explicitly filters `WHERE export_status = 'approved' AND eval_case_id IS NULL AND preferred IN ('A','B')`. This guarantees that benchmark evaluation cases can never leak into training datasets.
