# Implementation Plan: Carbonexo Full Web App

## Overview
Carbonexo is a mobile-first PWA for tracking and reducing a personal carbon footprint. The
design handoff fully specifies an animated marketing **landing page** and scopes a **7-screen
application** (onboarding, home dashboard, daily tracking, insights, action plan, AI coach,
profile/progress) for the next phase. This plan covers building the complete web app: the
pixel-faithful landing page plus all app screens, sharing one design-token system and a single
client-side data layer (localStorage — no backend in scope).

Stack: **Next.js 14 (App Router) + TypeScript + Tailwind v3 + Framer Motion**. State is local
only (theme, profile, logs, action plan), persisted to `localStorage`.

## Architecture Decisions
- **ThemeProvider lifted to the root layout** (not per-page as in the scaffold) so theme + the
  no-flash script persist across route navigation between landing and app.
- **Single domain module `lib/carbon.ts`** holds categories, emission factors, the Track option
  catalog, the Action catalog, and pure date/math helpers — no React, easy to unit-test/reason about.
- **Single store `lib/store.tsx`** (React context + `useReducer`) owns `profile`, `logs`, `plan`;
  persists to `localStorage` under `cx-state`; seeds realistic sample data on first load so every
  screen looks alive and the numbers match the design (today 6.8 kg, ↓12%, 5-day streak, 42 kg saved).
- **Route group `app/(app)`** carries the shared app shell (desktop sidebar / mobile bottom nav).
  Landing stays at `/`; onboarding at `/onboarding`; app screens at `/app/*`.
- **Onboarding gate:** entering `/app/*` before `profile.onboarded` redirects to `/onboarding`.
  Marketing CTAs ("Start Tracking") point at `/onboarding`.
- **Selectors are pure functions** over `logs`/`plan` (today total, breakdown, weekly series,
  streak, total saved) so screens stay thin and consistent.

## Dependency Graph
```
globals.css / tailwind tokens        [Phase 0 ✓]
        │
landing page (14 components)         [Phase 0 ✓]
        │
lib/carbon.ts (model + factors)      [Phase 0 ✓]
        │
lib/store.tsx (state + persist + seed + selectors)   ← FOUNDATION
        │
        ├── app/(app)/layout.tsx  (shell: sidebar / bottom nav, theme toggle)
        │        ├── /app                 Home dashboard      (reads store)
        │        ├── /app/track           Daily Tracking      (writes logs)
        │        ├── /app/insights        Insights            (reads store)
        │        ├── /app/actions         Action Plan         (reads ACTIONS, writes plan)
        │        ├── /app/coach           AI Coach chat       (reads store for canned answers)
        │        └── /app/profile         Profile / Progress  (reads store, reset, PWA install)
        │
        └── /onboarding   (writes profile, gates the app)
        │
PWA: manifest.webmanifest + sw.js + icons   (wires "Install as PWA")
        │
build + typecheck verification
```

## Task List

### Phase 0: Foundation — COMPLETE ✓
- [x] Task 0a: Project config (package.json, tsconfig `@/*`→root, next/postcss/tailwind), deps installed.
- [x] Task 0b: Design tokens (`app/globals.css`) + reduced-motion guards; `tailwind.config.ts` token mapping.
- [x] Task 0c: Root layout with `ThemeProvider` + `CarbonexoProvider` + no-flash script + PWA metadata.
- [x] Task 0d: Landing page — all 14 scaffold components recreated faithfully; CTAs wired to `/onboarding`.
- [x] Task 0e: `lib/carbon.ts` — categories, emission factors, Track + Action catalogs, helpers.

### Phase 1: Data layer + app shell + onboarding (the foundation everything else needs)

#### Task 1: Store — state, persistence, seed, selectors
**Description:** Build `lib/store.tsx`: a context + reducer holding `profile`, `logs`, `plan`,
persisted to `localStorage`. Seed realistic data on first run so the app matches the design
numbers. Expose actions (`addLog`, `removeLog`, `addAction`, `toggleAction`, `removeAction`,
`saveProfile`, `completeOnboarding`, `resetAll`) and pure selectors (today total, breakdown,
weekly series, streak, total saved, completed-action count).
**Acceptance criteria:**
- [ ] On first load with empty storage, seed produces today total ≈ 6.8 kg (travel 3.1 / food 1.9 / electricity 1.8) and a 5-day streak.
- [ ] All mutations persist and survive reload; `resetAll` clears storage and re-seeds.
- [ ] No hydration mismatch (storage read happens in effect; SSR renders a stable default).
**Verification:** `npm run typecheck`; manual: add a log, reload, log persists.
**Dependencies:** Task 0e. **Files:** `lib/store.tsx`. **Scope:** Medium.

#### Task 2: App shell + onboarding gate
**Description:** `app/(app)/layout.tsx` — responsive shell: desktop left sidebar (Home / Track /
Insights / Actions / Coach + Profile, logo, theme toggle) and mobile bottom nav (5 items). Redirect
to `/onboarding` when `!profile.onboarded`. Add a small reusable `ScreenHeader`/page-container.
**Acceptance criteria:**
- [ ] Sidebar on ≥`md`, bottom nav on mobile; active route highlighted in lime.
- [ ] Visiting `/app/*` without onboarding redirects to `/onboarding`.
- [ ] Theme toggle works inside the app; tokens render in both themes.
**Verification:** `npm run build`; manual: resize to mobile shows bottom nav.
**Dependencies:** Task 1. **Files:** `app/(app)/layout.tsx`, `components/app/AppNav.tsx`. **Scope:** Medium.

#### Task 3: Onboarding flow (vertical slice: profile → app)
**Description:** `/onboarding` — low-friction multi-step (travel mode, daily distance, diet,
electricity, shopping, weekly goal) with progress, back/next; on finish `saveProfile` +
`completeOnboarding` → redirect to `/app`.
**Acceptance criteria:**
- [ ] Steps validate minimally and remember selections; final step routes to `/app`.
- [ ] Completing sets `profile.onboarded=true` so the gate now lets the app through.
- [ ] Fully responsive, themed, motion on step transitions.
**Verification:** manual: run the flow end-to-end, land on dashboard.
**Dependencies:** Task 2. **Files:** `app/onboarding/page.tsx`, `components/onboarding/*`. **Scope:** Medium.

### Checkpoint: Foundation (after Tasks 1–3)
- [ ] `npm run typecheck` and `npm run build` clean.
- [ ] Landing → "Start Tracking" → onboarding → dashboard works end-to-end.
- [ ] Reload preserves state; theme persists across routes.

### Phase 2: Core loop — see + track

#### Task 4: Home dashboard (`/app`)
**Description:** Greeting, carbon score ring (today total + ↓/↑ vs yesterday), category breakdown
bars, 7-day weekly chart, AI insight card (biggest source), streak row, "Track Today" CTA →
`/app/track`. All from store selectors. Empty state when no logs today.
**Acceptance criteria:**
- [ ] Ring + numbers reflect live store data; delta computed vs yesterday.
- [ ] Weekly chart shows last 7 days with peak highlighted; breakdown matches `breakdown(today)`.
- [ ] Adding a log on Track is reflected here after navigation.
**Verification:** manual: log an item, return home, totals update.
**Dependencies:** Task 1, 2. **Files:** `app/(app)/page.tsx`, `components/app/*` (ScoreRing, WeeklyChart, etc.). **Scope:** Medium.

#### Task 5: Daily Tracking (`/app/track`)
**Description:** Category tabs (travel/food/electricity/shopping/waste) with quick-add options from
`TRACK_OPTIONS`; quantity input (km/kWh/item) with live CO₂ estimate; "Add" appends a log for today;
today's running footprint + list of today's entries with remove; "Save Today's Log" confirmation.
**Acceptance criteria:**
- [ ] Selecting an option + qty shows live estimate = factor × qty; Add creates a dated log.
- [ ] Running total and today's entry list update immediately; remove works.
- [ ] Empty + post-add states both render cleanly.
**Verification:** manual: add across categories, totals sum correctly.
**Dependencies:** Task 1, 2. **Files:** `app/(app)/track/page.tsx`, `components/app/*`. **Scope:** Medium.

### Checkpoint: Core loop (after Tasks 4–5)
- [ ] Track → Home reflects new data; numbers internally consistent.
- [ ] Build clean.

### Phase 3: Understand + act

#### Task 6: Insights (`/app/insights`)
**Description:** Biggest source callout, weekly/monthly trend chart, per-category share, and
plain-language explanations generated from the data (motivating, not guilt-based).
**Acceptance criteria:**
- [ ] Biggest source + share computed from logs; trend chart renders week series.
- [ ] At least 2 plain-language insight cards derived from real numbers.
**Verification:** manual: change data via Track, insights shift.
**Dependencies:** Task 1. **Files:** `app/(app)/insights/page.tsx`, `components/app/*`. **Scope:** Medium.

#### Task 7: Action Plan (`/app/actions`)
**Description:** Recommendation cards from `ACTIONS` (emoji, title, difficulty chip, est. CO₂
saving, "Add to My Plan"); My Plan list with check-to-complete; weekly goal progress bar driven by
completed savings vs `profile.weeklyGoalPct`.
**Acceptance criteria:**
- [ ] Add moves an action into My Plan; completing it increments saved total + goal bar.
- [ ] Difficulty colors per `DIFFICULTY_COLOR`; can remove from plan.
**Verification:** manual: add + complete an action, Profile saved total rises.
**Dependencies:** Task 1. **Files:** `app/(app)/actions/page.tsx`, `components/app/*`. **Scope:** Medium.

### Phase 4: Coach + profile

#### Task 8: AI Coach full chat (`/app/coach`)
**Description:** Full-screen chat seeded from the landing preview. User message → typing dots →
canned, data-aware response (references biggest source / savings). Suggestion chips, scroll-to-
latest, idle/loading/empty states.
**Acceptance criteria:**
- [ ] Sending a message (typed or chip) shows typing then a relevant response.
- [ ] References real store data (e.g., biggest source) in at least the default answers.
**Verification:** manual: ask a suggested question, get a coherent answer.
**Dependencies:** Task 1. **Files:** `app/(app)/coach/page.tsx`, `components/app/*`. **Scope:** Medium.

#### Task 9: Profile / Progress (`/app/profile`)
**Description:** Score summary, total saved, streak, completed actions, badges, profile fields
(editable), reset data, and the PWA install button wired to `usePwaInstall`.
**Acceptance criteria:**
- [ ] Shows live totals + badges; install button triggers prompt (or guidance fallback).
- [ ] Reset clears + re-seeds; edit profile persists.
**Verification:** manual: reset returns to seeded state.
**Dependencies:** Task 1. **Files:** `app/(app)/profile/page.tsx`, `components/app/*`. **Scope:** Medium.

### Checkpoint: App complete (after Tasks 6–9)
- [ ] All five app screens reachable from the shell and internally consistent.
- [ ] Build + typecheck clean.

### Phase 5: PWA + verification

#### Task 10: PWA manifest + service worker + icons
**Description:** `public/manifest.webmanifest` (name, theme `#84cc16`, bg per theme, icons),
`public/sw.js` (basic offline cache), SVG/PNG icons; ServiceWorker registration already stubbed.
**Acceptance criteria:**
- [ ] Manifest valid; install button surfaces on supported browsers; SW registers in prod build.
**Verification:** `npm run build`; manual: Lighthouse/installability sanity check.
**Dependencies:** Task 9. **Files:** `public/*`. **Scope:** Small.

#### Task 11: Final verification
**Description:** `npm run typecheck` + `npm run build`; click through every route in dev; fix
warnings/errors.
**Acceptance criteria:**
- [ ] Type-clean, build succeeds, every route renders in both themes, no console errors.
**Verification:** `npm run build && npm run dev` smoke test.
**Dependencies:** Tasks 1–10. **Files:** various. **Scope:** Small.

### Checkpoint: Complete
- [ ] All acceptance criteria met; ready for review.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Hydration mismatch from reading `localStorage` during render | Med | Read in `useEffect`; SSR uses stable defaults; `suppressHydrationWarning` already on `<html>`. |
| Seed data drifting from design numbers | Low | Seed is explicit per-entry to hit 6.8 kg split + 5-day streak; selectors derive the rest. |
| Route-group layout + onboarding redirect loop | Med | Gate only redirects when `!onboarded` and not already on `/onboarding`; effect-based redirect after hydration. |
| Emoji rendering inconsistency across platforms | Low | Accept for now (per handoff); icon-set swap is a noted future option. |
| Scope creep (no backend) | Low | Explicitly local-only; AI Coach uses canned, data-aware responses. |

## Open Questions
- Confirm scope = landing **plus** all 7 app screens (this plan assumes yes, per "full web app").
- Any preference for real Lucide icons over emoji now, or keep emoji as in the handoff? (Plan keeps emoji.)
