# Carbonexo — Task List

Status legend: [x] done · [ ] todo · order = dependency order.

## Phase 0 — Foundation (COMPLETE)
- [x] 0a. Project config + deps (Next 14, TS, Tailwind v3, Framer Motion)
- [x] 0b. Design tokens (globals.css) + reduced-motion guards + tailwind mapping
- [x] 0c. Root layout: ThemeProvider + CarbonexoProvider + no-flash script + PWA metadata
- [x] 0d. Landing page — 14 components, CTAs wired to /onboarding
- [x] 0e. Domain model lib/carbon.ts (factors, Track + Action catalogs, helpers)

## Phase 1 — Data + shell + onboarding
- [ ] 1. Store lib/store.tsx (state, localStorage persist, seed, selectors)
- [ ] 2. App shell app/(app)/layout.tsx (sidebar / bottom nav) + onboarding gate
- [ ] 3. Onboarding flow /onboarding (writes profile → /app)
- [ ] ▣ Checkpoint: typecheck + build clean; landing→onboarding→dashboard works; state persists

## Phase 2 — Core loop
- [ ] 4. Home dashboard /app (score ring, breakdown, weekly chart, insight, streak, Track CTA)
- [ ] 5. Daily Tracking /app/track (category tabs, quick-add, live estimate, today list)
- [ ] ▣ Checkpoint: Track→Home reflects data; build clean

## Phase 3 — Understand + act
- [ ] 6. Insights /app/insights (biggest source, trends, plain-language cards)
- [ ] 7. Action Plan /app/actions (recommendations, My Plan, complete, weekly goal bar)

## Phase 4 — Coach + profile
- [ ] 8. AI Coach /app/coach (full chat, typing→response, suggestion chips, states)
- [ ] 9. Profile / Progress /app/profile (totals, badges, edit, reset, PWA install)
- [ ] ▣ Checkpoint: all 5 app screens reachable + consistent; build + typecheck clean

## Phase 5 — PWA + verify
- [ ] 10. PWA manifest + sw.js + icons (wire Install button)
- [ ] 11. Final verification: typecheck + build + click-through both themes
- [ ] ▣ Checkpoint: complete, ready for review
