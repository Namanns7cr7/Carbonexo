# Carbonexo EcoMind: Full-Site Agentic Tool Inventory

**Version:** 2.0.0-fullsite  
**Status:** VERIFIED & DEPLOYED TO BRANCH `feat/ecomind-full-site-rag`  
**Security Profile:** STRICT READ-ONLY / AUTHENTICATED USER CONTEXT ONLY  

---

## 1. Architectural Principles

1. **Deterministic User Identification:** The AI model is strictly prohibited from selecting or passing a `userId` parameter. All personal tools derive the user identity solely from the cryptographically verified Spring `SecurityContextHolder` (`SecurityUtils.currentUserId()`). Any model attempt to pass a `userId` argument triggers an immediate `ToolArgumentException`.
2. **Read-Only Invariant:** All current tools operate in read-only mode (`isReadOnly: true`). Any tool capable of mutating user activity, redeeming credits, or joining groups is disabled pending multi-factor explicit user authorization.
3. **Field-Level Data Minimization:** Database projections exclude sensitive fields (passwords, password hashes, JWTs, emails, billing card tokens). Only calculated aggregates and necessary metadata are returned to the agent context.
4. **Number Grounding Integration:** Numerical outputs produced by deterministic tools are recorded into `GroundedNumbers`. The model's final response is verified to prevent fabricated metrics.

---

## 2. Complete Typed Tool Inventory

### Tool 1: `getGreenCreditBalance`
- **Domain:** Green Credits & Rewards
- **Backing Service:** `com.ecotrack.reward.RewardService` (or `com.ecotrack.ai.agent.GetGreenCreditBalanceTool`)
- **Input Contract:**
  ```json
  {
    "type": "OBJECT",
    "properties": {}
  }
  ```
- **Output Contract:**
  ```json
  {
    "status": "OK",
    "green_credits": 175,
    "lifetime_earned": 350,
    "lifetime_spent": 175,
    "pending_streak_bonus": 20
  }
  ```
- **Auth Requirements:** Authenticated user session (`ROLE_USER` or `ROLE_ADMIN`).
- **Data Freshness:** Real-time transactional query (`SELECT balance FROM user_credits WHERE user_id = ?`).
- **Region:** Global.
- **Source Provenance:** PostgreSQL authoritative ledger `user_credits` / `credit_transactions`.
- **Capability:** Read-Only.

---

### Tool 2: `getCarbonCreditScore`
- **Domain:** Credit Score (Engagement & Consistency)
- **Backing Service:** `com.ecotrack.ai.agent.GetCarbonCreditScoreTool`
- **Input Contract:**
  ```json
  {
    "type": "OBJECT",
    "properties": {}
  }
  ```
- **Output Contract:**
  ```json
  {
    "status": "OK",
    "score": 680,
    "scale": "300-850",
    "tier": "GOOD",
    "components": {
      "logging_consistency": 240,
      "reduction_trend": 190,
      "verification_bills": 130,
      "community_actions": 120
    },
    "can_still_improve": [
      "Upload this month's electricity bill to verify consumption (+25 pts)",
      "Maintain 7-day logging streak (+15 pts)"
    ]
  }
  ```
- **Auth Requirements:** Authenticated user session.
- **Data Freshness:** Calculated on-demand from trailing 90 days activity logs and bill uploads.
- **Region:** Global.
- **Source Provenance:** Authoritative score calculator engine.
- **Capability:** Read-Only.

---

### Tool 3: `getGreenCreditRules`
- **Domain:** Reward Rules & Earning Mechanisms
- **Backing Service:** `com.ecotrack.ai.agent.GetGreenCreditRulesTool`
- **Input Contract:**
  ```json
  {
    "type": "OBJECT",
    "properties": {}
  }
  ```
- **Output Contract:**
  ```json
  {
    "status": "OK",
    "rules": [
      {"action": "DAILY_LOG", "credits": 5, "awarded_by_app_today": true, "location": "Track page"},
      {"action": "BILL_UPLOAD_OCR", "credits": 50, "awarded_by_app_today": false, "location": "Bill Upload page"},
      {"action": "STREAK_7_DAYS", "credits": 25, "awarded_by_app_today": false, "location": "Dashboard"}
    ],
    "restrictions": "Carbonexo green credits are in-app loyalty reward points, not tradable carbon offset credits. Cannot be cashed out or transferred."
  }
  ```
- **Auth Requirements:** Authenticated user or public.
- **Data Freshness:** Static config / database-backed rule engine.
- **Capability:** Read-Only.

---

### Tool 4: `getRewardsCatalog`
- **Domain:** Rewards & Partner Vouchers
- **Backing Service:** `com.ecotrack.reward.RewardService` (`GetRewardsCatalogTool.java`)
- **Input Contract:**
  ```json
  {
    "type": "OBJECT",
    "properties": {}
  }
  ```
- **Output Contract:**
  ```json
  {
    "status": "OK",
    "rewards_count": 6,
    "rewards": [
      {
        "title": "Eco Store 10% Off Voucher",
        "description": "Valid on organic groceries and zero-waste items",
        "cost_credits": 150,
        "partner": "EcoStore India",
        "in_stock": true
      }
    ]
  }
  ```
- **Auth Requirements:** Authenticated user session.
- **Data Freshness:** Active catalog items from `rewards` table.
- **Capability:** Read-Only.

---

### Tool 5: `getUserActivityHistory`
- **Domain:** Personal Tracking & Activity History
- **Backing Service:** `com.ecotrack.carbon.ActivityLogRepository` (`GetUserActivityHistoryTool.java`)
- **Input Contract:**
  ```json
  {
    "type": "OBJECT",
    "properties": {
      "days": {"type": "INTEGER", "description": "Trailing days to inspect (1 to 30, default 7)"},
      "category": {"type": "STRING", "enum": ["ALL", "TRANSPORT", "ELECTRICITY", "FOOD", "SHOPPING", "WASTE"]}
    }
  }
  ```
- **Output Contract:**
  ```json
  {
    "status": "OK",
    "days_inspected": 7,
    "total_activities": 14,
    "total_co2_kg": 42.60,
    "activities": [
      {
        "date": "2026-10-18",
        "category": "TRANSPORT",
        "description": "Metro commute to work",
        "distance_km": 15.0,
        "emissions_kg": 0.22,
        "verification_status": "USER_REPORTED"
      }
    ]
  }
  ```
- **Auth Requirements:** Verified user identity from `SecurityContext`.
- **Capability:** Read-Only.

---

### Tool 6: `getActivityCategoryBreakdown`
- **Domain:** Dashboard & Category Footprint Breakdown
- **Backing Service:** `com.ecotrack.carbon.ActivityLogRepository` (`GetActivityCategoryBreakdownTool.java`)
- **Input Contract:**
  ```json
  {
    "type": "OBJECT",
    "properties": {
      "period": {"type": "STRING", "enum": ["today", "last_7_days", "this_month", "last_30_days"]}
    },
    "required": ["period"]
  }
  ```
- **Output Contract:**
  ```json
  {
    "status": "OK",
    "period": "last_30_days",
    "start_date": "2026-09-19",
    "end_date": "2026-10-18",
    "total_co2_kg": 116.50,
    "category_breakdown_co2_kg": {
      "TRANSPORT": 45.50,
      "ELECTRICITY": 71.00
    }
  }
  ```
- **Auth Requirements:** Scoped to `currentUserId`.
- **Capability:** Read-Only.

---

### Tool 7: `getEsgReportSummary`
- **Domain:** Reports & ESG Export (CSRD / BRSR metrics)
- **Backing Service:** `com.ecotrack.report.ReportService` (`GetEsgReportSummaryTool.java`)
- **Input Contract:**
  ```json
  {
    "type": "OBJECT",
    "properties": {}
  }
  ```
- **Output Contract:**
  ```json
  {
    "status": "OK",
    "lifetime_co2_saved_kg": 1250.50,
    "current_month_co2_kg": 145.20,
    "category_breakdown_kg": {
      "TRAVEL": 80.00,
      "ELECTRICITY": 65.20
    },
    "credits_earned": 350,
    "current_streak": 14,
    "total_activities_logged": 28,
    "account_start_date": "2026-01-01"
  }
  ```
- **Auth Requirements:** Verified user identity.
- **Capability:** Read-Only.

---

### Tool 8: `getUserBills`
- **Domain:** Electricity Bills & OCR Scanning
- **Backing Service:** `com.ecotrack.bill.BillService` (`GetUserBillsTool.java`)
- **Input Contract:**
  ```json
  {
    "type": "OBJECT",
    "properties": {}
  }
  ```
- **Output Contract:**
  ```json
  {
    "status": "OK",
    "total_bills_uploaded": 2,
    "recent_bills": [
      {
        "bill_id": "c1f7a28e-89a1-4d92-bf41-61b6c0e81c19",
        "status": "PROCESSED",
        "billing_month": "2026-08",
        "units_consumed_kwh": 220.00,
        "bill_amount": 1650.00,
        "currency": "INR",
        "created_at": "2026-09-01T10:00:00Z"
      }
    ]
  }
  ```
- **Auth Requirements:** Scoped to authenticated user.
- **Capability:** Read-Only.

---

### Tool 9: `getUserGroups`
- **Domain:** Community & Household Groups
- **Backing Service:** `com.ecotrack.social.GroupService` (`GetUserGroupsTool.java`)
- **Input Contract:**
  ```json
  {
    "type": "OBJECT",
    "properties": {}
  }
  ```
- **Output Contract:**
  ```json
  {
    "status": "OK",
    "groups_count": 1,
    "groups": [
      {
        "group_id": "8b9e6f3d-51f4-4e2b-b67a-115f082e6d99",
        "name": "Eco Warriors Bangalore",
        "invite_code": "WARRIORS2026",
        "member_count": 12
      }
    ]
  }
  ```
- **Auth Requirements:** Scoped to user's joined groups; individual member private activity is never exposed.
- **Capability:** Read-Only.

---

### Tool 10: `getEmissionFactors`
- **Domain:** Scientific Factor Registry
- **Backing Service:** `com.ecotrack.factors.EmissionFactorRegistry`
- **Input Contract:**
  ```json
  {
    "type": "OBJECT",
    "properties": {
      "activity_key": {"type": "STRING"},
      "region": {"type": "STRING", "enum": ["IN", "GB", "US", "GLOBAL"]}
    },
    "required": ["activity_key"]
  }
  ```
- **Output Contract:** Factor value, unit, source provenance (CEA v21.0, NITI Aayog 2026, DESNZ 2026), status (APPROVED), uncertainty boundaries.
- **Capability:** Read-Only.

---

### Tool 11: `calculateEmissionComparison`
- **Domain:** Travel & Activity Comparisons
- **Backing Service:** `com.ecotrack.ai.agent.CalculateEmissionComparisonTool`
- **Input Contract:** Baseline activity, alternative activity, distance/quantity, region.
- **Output Contract:** Baseline kg CO2, alternative kg CO2, hypothetical difference, uncertainty note.
- **Capability:** Read-Only.

---

### Tool 12: `runCarbonTwinScenario`
- **Domain:** Carbon Twin What-If Simulations
- **Backing Service:** `com.ecotrack.simulation.SimulationService`
- **Input Contract:** Scenario parameters (e.g., commute switch, solar installation), duration (month, year).
- **Output Contract:** Baseline footprint, simulated footprint, avoided emissions (labelled hypothetical), breakdown.
- **Capability:** Read-Only.

---

### Tool 13: `convertUnits`
- **Domain:** Exact Unit Conversions
- **Backing Service:** `com.ecotrack.ai.agent.ConvertUnitsTool`
- **Input Contract:** `value`, `from_unit`, `to_unit`.
- **Output Contract:** Exact converted numeric result using IEEE 754 / BigDecimal conventions.
- **Capability:** Read-Only.

---

### Tool 14: `calculate`
- **Domain:** Bounded Deterministic Arithmetic
- **Backing Service:** `com.ecotrack.ai.agent.CalculateTool`
- **Input Contract:** `expression` (bounded mathematical expression containing only grounded numbers).
- **Output Contract:** Exact arithmetic result.
- **Capability:** Read-Only.

---

### Tool 15: `retrieveScientificKnowledge`
- **Domain:** Scientific Guidance & Literature RAG
- **Backing Service:** `com.ecotrack.ai.agent.RetrieveScientificKnowledgeTool`
- **Input Contract:** `query`, optional `domain`.
- **Output Contract:** Relevant passages from OKF documents, CEA Baseline, IPCC AR6, NITI Aayog 2026.
- **Capability:** Read-Only.
