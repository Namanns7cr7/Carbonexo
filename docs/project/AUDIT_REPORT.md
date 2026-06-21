# AUDIT_REPORT.md — Carbonexo / EcoTrack

**Date:** 2026-06-18
**Scope:** Full audit of the existing frontend codebase prior to backend/database/AI work.
**Reviewer:** Senior Staff Engineer (architecture + security pass)
**Rule honored:** Read-only. No code changed in this phase.

---

## 0. Executive summary

The repository is a **complete, well-structured Next.js 14 (App Router) frontend** for a carbon-tracking PWA. It is **pixel-faithful to the design handoff**, fully typed, builds clean, and runs. However, it is a **100% client-only application**: all state lives in `localStorage`, there is **no backend, no database, no authentication, no persistence across devices, no file upload, no OCR, no AI provider, and no rewards/credit ledger**.

The product brief (this engagement) describes a far larger system — bill upload, OCR, server-side carbon engine, AI recommendations, green credits, redemption — **none of which exists yet**. The frontend is therefore best understood as a **high-fidelity UI shell with a mock data layer** that must be progressively wired to a real Spring Boot + PostgreSQL + Azure backend **without disturbing the UI**.

> ⚠️ **Naming note:** The brief calls the product *EcoTrack*; the existing code calls it *Carbonexo*. They are the same product. This report keeps the code name (Carbonexo) when referring to existing artifacts and uses *EcoTrack* only where the brief does. No rename is proposed (rename = needless churn, breaks PWA identity).

> ⚠️ **Missing source docs:** The brief's Phase 2 references PRD, TRD, App Flow, Design Document, Schema.md, and an Implementation Plan. **None of these exist in the repo or the design handoff.** The only specs present are the design handoff `README.md` (landing-page visual spec + future-phase screen list) and the reference HTML. **The brief itself is therefore treated as the authoritative PRD/TRD/Schema source** for all subsequent phases. This is the single biggest planning risk and is tracked in GAP_ANALYSIS.md.

---

## 1. Technology inventory

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | Next.js (App Router) | 14.2.5 | RSC + client components; **not** a plain CRA/Vite React SPA (affects API integration approach) |
| Language | TypeScript | 5.5 | `strict` via Next defaults; path alias `@/*` → project root |
| UI runtime | React | 18 | |
| Styling | Tailwind CSS | 3.4 | `darkMode: 'class'`; design tokens → CSS variables |
| Animation | Framer Motion | 11 | scroll reveals, parallax |
| State | React Context + `useReducer` | — | persisted to `localStorage` (`cx-state`, `cx-theme`) |
| PWA | custom `manifest.webmanifest` + `sw.js` | — | network-first SW, `beforeinstallprompt` capture |
| Build | Next build | — | 11 static routes, clean typecheck/build |
| Backend | **none** | — | ❌ to be built |
| Database | **none** (localStorage only) | — | ❌ to be built |
| Auth | **none** | — | ❌ to be built |

---

## 2. Existing features (what works today)

**Marketing landing page (`app/page.tsx`)** — fully built, animated, themed:
- Navbar (sticky, scroll-progress, active-link IO, mobile menu), Logo, ThemeToggle.
- Hero with mouse-parallax dashboard cluster (`DashboardPreview`), count-up stats.
- JourneyFlow (5 steps), FeatureCards (4), CarbonSwapSection, ProgressSection (count-ups + badge), AICoachPreview (typing→reply state machine), FinalCTA (PWA install button).
- Ambient background + wind-leaves, both reduced-motion gated.

**App (authenticated-style) screens under `app/app/*`** — all built against the mock store:
- **Onboarding** (`app/onboarding/page.tsx`) — 7-step wizard; writes profile, sets `onboarded`, redirects to `/app`.
- **Home dashboard** (`app/app/page.tsx`) — score ring, delta vs yesterday, category bars, AI-insight card (static copy), weekly chart, streak, Track CTA.
- **Daily Tracking** (`app/app/track/page.tsx`) — category tabs, quick-add catalog, qty input, live estimate, add/remove logs.
- **Insights** (`app/app/insights/page.tsx`) — headline stats, biggest source, weekly trend, category bars, plain-language insight strings.
- **Action Plan** (`app/app/actions/page.tsx`) — weekly goal bar, My Plan (toggle/remove), recommendation catalog (add).
- **AI Coach** (`app/app/coach/page.tsx`) — full chat with **canned, keyword-routed** replies (no real LLM).
- **Profile / Progress** (`app/app/profile/page.tsx`) — identity, stat grid, badges, habits, PWA install card, reset.
- **App shell** (`app/app/layout.tsx`) — Sidebar / MobileTopBar / BottomNav; onboarding gate via `router.replace('/onboarding')` when `!profile.onboarded`.

**Domain model (`lib/carbon.ts`)** — pure, well-factored, and **the de-facto schema source**:
- `Category` = travel | food | electricity | shopping | waste.
- `TRACK_OPTIONS` — per-category quick-add items with **emission factors** (kg CO₂/unit), units, defaults.
- `ACTIONS` — 8 recommendation templates with weekly saving (kg) + difficulty.
- Pure helpers: `dayKey`, `lastNDays`, `dayTotal`, `breakdown`, `round1`.

**State layer (`lib/store.tsx`)** — `useReducer` over `{ profile, logs, plan, stats }`, SSR-safe hydration, `localStorage` persistence, realistic seed matching the design numbers, derived selectors (todayTotal, deltaPct, weekTotals, streak, totalSaved, biggestSource, etc.).

---

## 3. Missing features (vs the brief) — the real work

| # | Capability | Status | Brief phase |
|---|---|---|---|
| 1 | User accounts, login/register | ❌ none | 4b |
| 2 | JWT + refresh-token auth | ❌ none | 4b |
| 3 | Server persistence (PostgreSQL) | ❌ localStorage only | 3 |
| 4 | REST API + DTO/validation/error layer | ❌ none | 4 |
| 5 | Electricity bill upload (PDF/PNG/JPG) | ❌ none | 5 |
| 6 | Azure Blob storage | ❌ none | 5 |
| 7 | OCR extraction (month/units/amount) + manual correction | ❌ none | 6 |
| 8 | Server carbon engine, config-driven factors | ⚠️ factors hardcoded client-side | 7 |
| 9 | Green Credit engine (rules, ledger, balance, redemption) | ❌ none | 8 |
| 10 | Rewards marketplace APIs | ❌ none | brief deliverable #8 |
| 11 | Real AI recommendations (multi-provider) | ⚠️ canned client strings only | 9 |
| 12 | Prompt template store | ❌ none | 9 |
| 13 | Centralized config (env/db tables) | ⚠️ values inline in TS | 10 |
| 14 | Frontend↔backend API integration | ❌ none | 11 |
| 15 | Observability (logs/trace/health/metrics) | ❌ none | 12 |
| 16 | Architecture/API/DB/Deploy/Security docs | ❌ none | 13 |

---

## 4. Broken / fragile findings

| Severity | Area | Finding | Recommendation |
|---|---|---|---|
| 🟠 Med | `components/DashboardPreview.tsx` | Dev log showed a **stale "Unexpected token `div`" Turbopack/SWC parse error** that then `✓ Compiled`. The file on disk is valid JSX. Almost certainly a transient from mid-edit hot-reload, not a real defect. | Verify with a fresh `npm run build`; if it reproduces, it's a tooling cache issue (clear `.next`), not source. |
| 🟡 Low | `public/manifest.webmanifest` | `start_url: "/app"` but the app **gate redirects un-onboarded users to `/onboarding`** — first PWA launch bounces. Also a non-onboarded/unauthed user opening the installed app has no real session (post-backend). | After auth lands, `start_url` should resolve to a route that branches on auth/onboarding server-side. |
| 🟡 Low | PWA icons | `manifest` references only `/icon.svg` for all sizes incl. `maskable`. Some Android launchers want raster `192/512` PNGs. | Add PNG icons before store/PWA submission. |
| 🟡 Low | `lib/store.tsx` | No state **schema migration** path beyond a `version` equality check — a bumped `VERSION` silently discards user data. | Once server-backed, localStorage becomes a cache only; add a migration/merge or clear-on-mismatch with re-fetch. |

No functional blockers. The app builds and runs.

---

## 5. Improvement opportunities (UI — keep minimal per brief rule #7)

- **Loading/empty/error states**: app screens assume the mock store is instantly available (`hydrated` flag only). Once data is fetched over the network, every screen needs real loading skeletons + error retry. The existing `Loading`/`EmptyState` in `components/app/ui.tsx` are a good base to extend.
- **Emoji → icon set**: handoff itself recommends swapping emoji for Lucide for cross-platform consistency. Defer; cosmetic.
- **Bill upload UI**: there is currently **no UI surface** for the brief's central feature (electricity bill upload + OCR review/correct). This is the one place new UI is genuinely required (a Track sub-screen or dedicated route), built with existing components.
- **Rewards/redemption UI**: no marketplace screen exists; needed for credits deliverable. New screen, existing components.

---

## 6. Technical debt

- **Factors duplicated & hardcoded** in `lib/carbon.ts` (`TRACK_OPTIONS`, `ACTIONS`). The brief (Phases 7/8/10) forbids hardcoded emission factors and reward values. These must move to **DB config tables** and be **served to the client**, with the TS catalog reduced to a typed fallback/default.
- **Business logic on the client**: streak, totals, savings, "biggest source" are computed in `lib/store.tsx`. Post-backend, the **server becomes the source of truth**; client selectors should consume API responses, not recompute authoritative numbers (client may keep them for optimistic UI only).
- **No tests** anywhere (no unit/integration/e2e). New backend must ship with tests; frontend integration layer should get at least service-layer tests.
- **Seed/mock data** (`seed()` in `lib/store.tsx`) encodes the design's demo numbers; must be replaced by real API data while keeping a demo/guest fallback.

---

## 7. Security issues (current frontend)

| Severity | Finding | Notes / fix direction |
|---|---|---|
| 🟠 Med | **No authentication or authorization** | Entire app is open; "Yash" is hardcoded. Backend must own identity (Phase 4b). |
| 🟠 Med | **All data in `localStorage`** (unencrypted, XSS-readable) | Acceptable for a demo; once real PII/bills exist, tokens must be handled carefully (prefer httpOnly refresh cookie; access token in memory). |
| 🟡 Low | **No CSP / security headers** | `next.config.mjs` sets no headers. Add CSP, HSTS, X-Content-Type-Options, Referrer-Policy in Phase 12/deploy. |
| 🟡 Low | **SW caches everything network-first incl. authed responses** | `public/sw.js` caches all GET responses; post-auth this can leak one user's cached data to another on a shared device. Exclude `/api/*` and authed responses from the SW cache. |
| 🟡 Low | **`dangerouslySetInnerHTML`** for the no-flash theme script (`app/layout.tsx`) | Static, developer-authored string — safe as-is, but note it for CSP nonce handling. |
| 🟢 Info | No secrets in the repo | Confirmed — nothing to rotate. Backend secrets must live in env/Key Vault (Phase 10). |

---

## 8. What must NOT change (brief rules 1–7)

Preserve verbatim: folder structure (`app/`, `components/`, `lib/`, `public/`), routing (`/`, `/onboarding`, `/app/*`), the component hierarchy, the design tokens, and the working landing page. **`components/DashboardPreview.tsx` positioning is intentionally tuned — do not "fix" it.** Backend work lives in a **new sibling `backend/` (Spring Boot) and `database/` tree**; frontend changes are limited to an additive **API service layer** + wiring existing screens to it + the two genuinely-new UI surfaces (bill upload, rewards).

---

## 9. Verdict

The frontend is a **strong, faithful, production-grade UI** with a **mock data core**. There are **no rewrites required** — the entire backend/AI/storage stack is **greenfield** and can be built additively. Proceed to GAP_ANALYSIS.md, then the roadmap, then execute Phases 3→13.
