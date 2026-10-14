# Carbonexo — The Living Planet Engine · Implementation Plan

**Branch:** `feat/carbonexo-living-world`
**Base commit:** `fb41f4f1023687b3ce4025e3a74cefdffc63481f` (`origin/sak` — "Whole-app look-and-feel polish pass")
**Created:** 2026-10-14
**`sak` status:** untouched. Not modified, merged into, force-pushed, or deleted. Nothing pushed.

---

## 1. Verified baseline

Every number below was produced by running the command on this branch, not read from a badge or a previous report.

| Check | Command | Result |
|---|---|---|
| Frontend typecheck | `npm run typecheck` | **pass**, 0 errors |
| Frontend lint | `npm run lint` | **pass**, 0 warnings |
| Frontend unit tests | `npm test` | **pass** — 14 files, 62 tests (56 at base + 6 added here) |
| Frontend production build | `npm run build` | **pass** — 20 routes, 87.1 kB shared JS |
| Backend tests | `mvn -B test` | **pass** — 19 classes, 98 tests, 0 failures, 0 errors, 0 skipped |

**Correction to existing docs:** the README badge claims "106 tests passing". Actual total is **154** (56 frontend + 98 backend) at the base commit. The badge is stale and understates.

**Correction to existing docs:** `docs/reference/ARCHITECTURE.md` says "16 tables"; `docs/reference/DATABASE.md` lists 18. The schema actually has **21** — the docs predate `groups`, `group_members` (V6) and `embodied_carbon_factors` (V7).

### Toolchain present
Node 22.19.0 · npm 11.11.0 · Temurin JDK 17.0.19 · Maven 3.9.9 (**no `mvnw` wrapper — use `mvn`**) · Docker 29.1.5

---

## 2. Working tree inherited at branch creation

The base commit did **not** represent the full state on disk. Four files carried uncommitted work that was not mine and is not in `origin/sak`. It has been committed on this branch so nothing is lost and the diff is reviewable:

| Commit | Contents |
|---|---|
| `f0f2e2d` | FedCM for Google Sign-In (`use_fedcm_for_prompt` + `identity-credentials-get` Permissions-Policy). Plus `.gitignore` for the local Obsidian vault. |
| `182d40a` | Pre-existing WIP, committed as-is: in-flight GET dedup + 60s catalog cache in `lib/api/client.ts`; optimistic `addLog`/`removeLog` in `lib/store.tsx`. |
| `a9b8ec8` | **Blocking bug fix** in that WIP — see §3. |

Still untracked, deliberately not committed (documentation artifacts, not source):
`docs/architecture.html`, `docs/architecture-visualization.html`, `public/architecture-visualization.html`

---

## 3. Blocking defect found and fixed before any redesign work

**`lib/api/client.ts` — deduplicated GET deadlocked on token expiry.**

The inherited WIP registers every in-flight GET in a `Map` keyed by path and returns the existing promise to concurrent callers. The post-refresh retry is issued *from inside* that promise, for the same path — so `apiFetch` handed the retry the promise it was already running inside. The promise awaited itself and never settled.

Consequence: any authenticated GET that received a 401 **hung forever** — no error, no timeout, no redirect. With `JWT_ACCESS_TTL=900`, that is the ordinary path every 15 minutes, not an edge case. The first dashboard or activity fetch after expiry would spin indefinitely.

Proven with a failing test before the fix (`DEADLOCK: never settled in 2500ms`), then fixed by scoping dedup to the outermost call only (`retryCount === 0`, for both lookup and registration). Six regression tests added covering the replay path, refresh failure, concurrent collapsing, per-path isolation, cache invalidation on mutation, and cache eviction on `clearTokens`. The pre-existing suite exercised none of these.

---

## 4. Architecture as it actually stands

```
Next.js 14.2.5 (App Router, :3000)
  app/                 20 routes — marketing shell + /app/* product shell
  lib/store.tsx        React context; branches on isAuthenticated()
                       → REST when signed in, seeded localStorage when not
  lib/api/*.ts         11 typed modules, all funnelling through client.ts
  lib/carbon.ts        pure domain model
        │  HTTP + Bearer JWT
        ▼
Spring Boot 3.3.4 (Java 17, :8080)
  11 controllers under /api — auth, profiles, activities, dashboard, bills,
  credits, rewards, ai, groups, products, simulations
  Stateless security: JwtAuthenticationFilter → UserPrincipal → SecurityContext
  Provider seams: AIProvider · OcrProvider · BlobStorageService
        │  JDBC (HikariCP, max 10)
        ▼
PostgreSQL 16 — 21 tables, UUID PKs, audit columns, soft delete
  Schema owned by Flyway (V1–V9). ddl-auto: none — Hibernate never mutates
  or validates. Local: docker-compose. Prod: Cloud SQL via socket factory.
```

### Design tokens already exist — extend, do not replace
Phase 1 asks for a token system. One is already in place and must be built on:
- `app/globals.css` — CSS custom properties on `:root` and `.dark`
- `tailwind.config.ts` — maps every token to a Tailwind colour utility
- Fonts: Bricolage Grotesque (display) · Manrope (body) · JetBrains Mono
- Dark mode is **class-based** (`.dark` on `<html>`), set pre-hydration by an inline script in `app/layout.tsx` to avoid a flash

**Trap:** in `.dark`, `--bg` and `--ink` are *gradients*, not colours. `bg-bg` / `bg-ink` Tailwind utilities break there; they must be applied via the `background` property. Any new surface token must follow the same rule or be defined as a flat colour in both themes.

### Landing page is already sectioned
`HeroSection` · `CarbonSwapSection` · `JourneyFlow` · `ProgressSection` · `FeatureCards` · `AICoachPreview` · `DashboardPreview` · `FinalCTA`, with `AmbientBackground`, `WindLeaves`, `Reveal`. 17 files already use Framer Motion. The chapter structure in Phase 2 is a re-composition of existing parts plus new scene work, not a greenfield build.

### Motion/3D dependencies
Installed: `framer-motion@^11.3.19` only. **No** Three.js, React Three Fiber, GSAP, or Lenis. Phase 3 requires a deliberate dependency decision (§6).

### No persistence for quests / XP / habitats
Phases 4–5 require state that has no table today. There is no `xp`, `level`, `quest`, `streak` (beyond derived), or `habitat` column anywhere in V1–V9. This is new schema work: migrations **V10+**, new entities, new controllers, server-side validation. The brief forbids hardcoded demo numbers for habitat unlocks, so this is not optional.

---

## 5. Behaviour that must be preserved

Non-negotiable; the redesign wraps these, never reimplements them.

- **Auth** — BCrypt, 900s access / 14d rotating refresh, hashed tokens in `refresh_tokens`, Google ID-token verification against `GOOGLE_CLIENT_ID`, single-retry 401 self-heal.
- **Carbon accounting** — `CarbonCalculationService` and the `emission_factors` table. Formulas and credit semantics are not to be changed without explicit written approval.
- **Credit ledger** — `credit_ledger` is append-only; balance is `SUM(delta)`. XP must **not** be awarded as ledger credits. They are separate currencies and must read as separate in the UI.
- **Soft delete** — no global filter exists. Every new query must spell out `deletedAt IS NULL` or it will silently return deleted rows.
- **Simulation is read-only** — `SimulationController` must stay side-effect free.
- **AI fallback** — `AI_FALLBACK=true` degrades a Gemini failure to `CannedFallbackProvider`. Backend tests deliberately throw `boom` to assert this; keep it.
- **Config hierarchy** — `application.yml` → env → `app_config` table. No business number moves into Java or TSX.
- **Offline dev** — `local_stub` storage, `tesseract` OCR, `canned` AI must keep the app runnable with no Google credentials.

---

## 6. Dependency decision for Phase 3

The brief requires justification before adding anything heavy. Assessment:

| Option | Verdict |
|---|---|
| **Framer Motion** (installed) | Keep as the primary engine. Covers scroll progress, springs, drag with inertia, layout transitions, gesture physics, `useReducedMotion`. Carries Chapters 3, 5, 6 and all of Phase 6 with no new dependency. |
| **React Three Fiber + three** | **Justified for Chapters 1–2 and the EcoWorld scene only.** A rotating lit planet with atmospheric depth and a camera that scroll-dollies is not honestly achievable in DOM/SVG. Cost ≈ 150 kB gzipped — must be `next/dynamic` with `ssr: false`, mounted only on routes that use it, so the 87 kB shared bundle is unaffected for everyone else. Requires a WebGL-failure fallback and a static poster for reduced-motion. |
| **GSAP ScrollTrigger** | **Reject.** Overlaps Framer Motion's scroll primitives; two scroll systems on one page is a conflict risk, and ScrollTrigger's pinning tempts scroll hijacking, which the brief forbids. |
| **Lenis / smooth scroll** | **Reject.** `html { scroll-behavior: smooth }` is already set. Momentum libraries fight native scroll, break keyboard paging, and are an accessibility regression. |

**Mobile/no-GPU path is a first-class requirement, not a fallback.** Every 3D scene needs a CSS/SVG equivalent that carries the same information, selected by capability detection *and* `prefers-reduced-motion`, and the chapter must be comprehensible from text and static composition alone.

---

## 7. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Cloud Build mis-compiles the root layout.** `app/layout.tsx` carries a comment that a Linux Cloud Build ignores `export const dynamic` and ships a broken client bundle; deploys must use `deploy-frontend-local.ps1`. | **High** | Do not deploy from CI. Verify any layout change with a local production build. Investigate properly before the redesign touches `layout.tsx`. |
| WebGL scenes tank Core Web Vitals or fail on low-end mobile | High | Dynamic import, offscreen pause via `IntersectionObserver`, capped DPR, capability-gated effect tiers, static poster fallback. |
| New XP/quest schema corrupts existing user records | High | Additive migrations only — new tables, nullable columns, no destructive DDL. Backfill defaults. Test against a seeded DB before merge. |
| Quest XP double-claim / replay exploit | High | Server-side validation with a unique constraint on `(user_id, quest_key, quest_date)`. Never trust a client-reported completion. |
| Gamifying carbon misleads users | Medium | Keep XP, promotional credits and estimated kg CO₂ visually and textually distinct. Label illustrative figures as illustrative. No copy implying a real forest was restored. |
| Scope: Phases 1–9 is a multi-week build | **High** | See §9. Sequence by demo value; land each phase behind a working build. |
| Soft-delete clause forgotten in new queries | Medium | Mirror existing repository naming; review every new query against §5. |
| 20 routes to redesign, all needing mobile + a11y | Medium | Token and motion foundation first; migrate routes one commit at a time. |

---

## 8. Task checklist

**Phase 0 — Audit** ✅ complete
- [x] Fetch, inspect working tree, record base SHA
- [x] Branch `feat/carbonexo-living-world` from `origin/sak`; `sak` untouched
- [x] Preserve inherited uncommitted work in reviewable commits
- [x] Audit routes, API contracts, schema, auth, AI, tokens, components
- [x] Run typecheck / lint / unit tests / production build / backend tests — real results in §1
- [x] Find and fix the GET-deadlock defect, with regression tests
- [x] This document

**Phase 1 — Visual direction** ✅ complete
- [x] Extend `globals.css` + `tailwind.config.ts` with scene, lighting, depth and motion tokens — all flat colours, so the gradient-token trap does not apply
- [x] Motion token scale in `lib/motion.ts`: durations, easings, spring presets, stagger
- [x] Capability tiers (`full` / `lite` / `still`) with a pure resolver + `useMotionTier` hook and a cached, context-releasing WebGL probe
- [x] Variant factories (`fadeUp`, `sceneEnter`, `stagger`) matching the existing `<Reveal>` feel at `full`
- [x] 25 tests. Shared JS unchanged at 87.1 kB

Token contract for later phases: never inline a transition object — import from
`lib/motion.ts`, and gate every effect on `useMotionTier()`. `allowsWebGL(tier)`
is the only sanctioned check before mounting a 3D scene.

**Phase 2 — Scroll story** 🟡 Chapter 1 complete
- [x] `Scene` primitive — full-viewport, labelled, exposes its own scroll progress; no pinning, no wheel capture, no programmatic scroll
- [x] **Ch.1 planet** — `components/chapters/ChapterPlanet.tsx`, mounted at `/welcome`
- [ ] Ch.2 trace · Ch.3 impact · Ch.4 twin · Ch.5 change · Ch.6 CTA
- [x] Visible nav retained, native scroll/keyboard/back intact, comprehensible at `still`

Chapter 1 technique notes (CSS/SVG only — no three.js, no R3F, no GSAP):
- Rotation is a horizontally-tiling background slid by exactly one tile width
  (500px land / 700px cloud), which loops seamlessly on one composited layer.
  Clouds travel faster than land, so the two parallax.
- Pointer drives `useMotionValue` → `useSpring` only. Nothing re-renders per
  frame. Perspective, the lit limb (`useMotionTemplate`) and text planes all
  read from the same two springs.
- Scroll dollies the camera via `useTransform` on native scroll progress.
- Star and mote positions come from a seeded `mulberry32` at module scope, so
  SSR and client markup are byte-identical — `Math.random` would mismatch.
- At `still`: no spin, no parallax, no scroll transform, motes unmounted, text
  fully legible. Verified in the SSR output, which is the `still` state.

**Removed invented data:** `HeroSection` claimed "120k+ daily trackers",
"2.4M kg CO₂ saved together" and a "4.9★ app rating" — none of it real. Chapter 1
supersedes it and the component is no longer rendered.

**Phase 3 — Motion engine** ⬜ not started
- [ ] R3F behind dynamic import; WebGL failure + poster fallback
- [ ] Reusable: scroll camera, parallax, spring objects, drag inertia, magnetic buttons, particles, scene transitions
- [ ] Offscreen pause, DPR cap, capability tiers, frame-loop isolation from React state

**Phase 4 — EcoWorld home** ⬜ not started
- [ ] World-first `/app` hierarchy; drag/rotate/inspect; accessible 2D equivalent
- [ ] Habitat unlocks driven by persisted milestones only

**Phase 5 — Daily quests** ⬜ not started
- [ ] Migration V10+: quests, completions, XP, unlocks (+ unique constraints)
- [ ] Entities, repositories, controller, server-side award validation, tests
- [ ] Deterministic XP; duplicate protection; considerate streak recovery; XP ≠ credits

**Phase 6 — Feature redesigns** ⬜ not started
- [ ] Logger · Carbon Twin · Coach · Insights · Bill OCR · Scanner · Groups · Credits/Rewards · Onboarding · Profile

**Phase 7 — Real functionality** ⬜ not started
- [ ] No dead controls or mocked responses in production routes; end-to-end verification per screen

**Phase 8 — Quality** ⬜ not started
- [ ] Keyboard, focus, SR descriptions, touch targets, responsive, error/empty/loading/retry, reduced motion, animation cleanup, auth safety, mobile nav
- [ ] Full check suite + honest report

---

## 9. Scope reality

Phases 1–9 as written is a multi-week build for a team: a 3D scene system, six cinematic chapters, a new persistence layer with migrations and server-side validation, and ten redesigned feature journeys, all with accessibility and mobile parity. It will not be completed honestly in one session, and a partially-built motion engine over a working product is worse than either end state.

Phase 0 is done and the blocking defect is fixed, so the branch is in a known-good, fully-green state to build from.

**Recommended sequencing by demo value**, highest first:
1. **Phase 1** — token and motion foundation (small, unblocks everything, zero risk)
2. **Chapter 1 landing** — the planet. Single highest visual payoff per unit of work
3. **Phase 4 EcoWorld home** — the idea that makes the product distinctive
4. **Phase 5 persistence** — required to make EcoWorld honest rather than a hardcoded demo
5. Chapters 2–6, then Phase 6 feature-by-feature

If there is a fixed deadline, stopping after step 3 yields a coherent, demoable product. Steps 4–5 are where the real engineering time goes, and they are invisible in a short demo — worth knowing before committing the time.

---

## 10. Local run

```bash
# 1 — database
docker compose -f database/docker-compose.yml up -d

# 2 — API (Flyway migrates on boot; no mvnw wrapper in this repo)
cd backend && mvn spring-boot:run        # :8080, swagger at /swagger-ui.html

# 3 — web
npm install && npm run dev               # :3000

# checks
npm run typecheck && npm run lint && npm test && npm run build
cd backend && mvn -B test
```

Signed out, the app runs entirely on seeded `localStorage` state — no backend or database needed to view the UI.
