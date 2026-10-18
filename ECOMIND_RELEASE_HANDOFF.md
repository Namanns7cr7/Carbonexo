# Carbonexo EcoMind: Release & Deployment Handoff

**Handoff Date:** 2026-10-18  
**Branch:** `feat/ecomind-full-site-rag` (detached from release base `61d7837`)  
**Deployment Target:** Google Cloud Run (Asia South 1 / Mumbai)  
**Safety Status:** ZERO INTERFERENCE WITH RUNNING CLAUDE DEPLOYMENT SESSION  

---

## 1. Parallel Session Coordination & Safety Confirmation

A separate Claude session is actively deploying Carbonexo in `D:/4 year/Carbonexo-gcp` (branch `main`). 

### Strict Safety Invariants Maintained:
- **No Shared File Overwrite:** All EcoMind full-site work was developed in the dedicated branch `feat/ecomind-full-site-rag`.
- **No Production Mutation:** Zero changes were applied to Cloud Run traffic, production Cloud SQL, Cloud Secret Manager, or the remote `main` branch.
- **Budget Compliance:** Autonomous evaluation and latency benchmarking executed locally and offline within the $0.00 spend boundary (zero unauthorized Vertex GPU/TPU training jobs).

---

## 2. Exact Files Changed & Added

### A. New Spring Boot Agent Tools (`backend/src/main/java/com/ecotrack/ai/agent/`):
1. `GetEsgReportSummaryTool.java`: Connects to `ReportService.getEsgSummary(userId)` for official CSRD/BRSR metrics.
2. `GetUserGroupsTool.java`: Connects to `GroupService.getMyGroups(userId)` for community/household groups.
3. `GetUserBillsTool.java`: Connects to `BillService.listByUser(userId)` for electricity bills and OCR processing status.
4. `GetRewardsCatalogTool.java`: Connects to `RewardService.getCatalog()` for redeemable reward vouchers.
5. `GetActivityCategoryBreakdownTool.java`: Connects to `ActivityLogRepository.breakdownByCategory` for travel, power, food, shopping, and waste emission splits.

### B. Router & Safety Enhancements:
6. `CoachRouter.java`: Added support for 5 new domain intents (`REPORT_EXPLANATION`, `COMMUNITY`, `BILLS_OCR`, `REWARDS_CATALOG`, `CATEGORY_BREAKDOWN`), tuned precedence so rewards catalog takes priority over general credit rules, and refined regex boundaries.

### C. Test Verification Suites (`backend/src/test/java/com/ecotrack/ai/agent/`):
7. `NewAgentToolsTest.java`: 6 automated unit tests validating user-scoping, output key structures, and refusal of model-supplied `userId`.
8. `CoachRouterTest.java`: Added verification for the new domain intents and required tools.

### D. Autonomous Evaluation & RLHF Tools (`scripts/` & Workspace Root):
9. `scripts/build_ecomind_eval_suite.py`: Expands the 172-case benchmark to 837 scenarios.
10. `scripts/run_ecomind_evaluation.py`: Automated evaluation runner checking routing, SLA, and security.
11. `scripts/train_preference_adapter.py`: Formats consented preferences for SFT/DPO and enforces leak detection against held-out prompts.
12. `scripts/measure_ecomind_latencies.py`: Benchmarks fast-path routing over 30,000 iterations.
13. `ECOMIND_EVAL_SUITE.jsonl`: Complete 837-scenario test suite across all 36 Carbonexo categories.
14. `ecomind_eval_summary.json` & `latency_benchmark_results.json`: Machine-readable results.

---

## 3. Test Verification Summary

| Test Suite | Total Run | Failures | Status | Execution Command |
| :--- | :---: | :---: | :---: | :--- |
| **New Agent Tools Unit Tests** | 6 | 0 | **PASS** | `mvn test -Dtest=NewAgentToolsTest` |
| **Deterministic Router Tests** | 43 | 0 | **PASS** | `mvn test -Dtest=CoachRouterTest` |
| **Agent Safety & Isolation Tests** | 13 | 0 | **PASS** | `mvn test -Dtest=AgenticCoachSafetyIntegrationTest` |
| **Agent Service Integration Tests** | 11 | 0 | **PASS** | `mvn test -Dtest=AgenticCoachServiceIntegrationTest` |
| **Coach Security Integration Tests**| 13 | 0 | **PASS** | `mvn test -Dtest=CoachSecurityIntegrationTest` |
| **Deterministic Math & Tools Tests**| 6 | 0 | **PASS** | `mvn test -Dtest=DeterministicToolsTest` |
| **PgVector AI Memory Tests** | 13 | 0 | **PASS** | `mvn test -Dtest=PgVectorCoachMemoryTest` |
| **Full Site Evaluation Suite** | 837 | 0 | **PASS (100%)** | `python scripts/run_ecomind_evaluation.py` |
| **Frontend TypeScript Verification** | All files | 0 | **PASS** | `npx tsc --noEmit` |
| **Live Browser E2E Interaction** | Full Session | 0 | **PASS** | Chrome DevTools Protocol subagent |

---

## 4. Database Migration Requirements

- **Compatibility:** 100% Backwards-Compatible and Additive.
- Existing migrations (`V15__ai_coach_feedback.sql`, `V16__agentic_coach_config.sql`, `V17__coach_safe_mode_and_router.sql`) provide all required tables (`ai_responses`, `ai_feedback`, `ai_review_pairs`).
- No DDL mutations or breaking column alterations are required.

---

## 5. Deployment Recommendations for Session 2

When the parallel deployment session completes its Cloud Run release:
1. Merge branch `feat/ecomind-full-site-rag` into `main`.
2. Deploy the updated backend container with:
   - Primary model: `gemini-2.5-flash` (or `gemini-3.0-flash-preview` via `GeminiRestAgentModelClient`).
   - Location: `asia-south1`.
   - Tool calling: Enabled (REST protocol).
3. The Next.js frontend is already fully compatible and requires zero config changes.
