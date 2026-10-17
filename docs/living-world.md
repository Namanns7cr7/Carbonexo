# Living World: one planet, one state, the whole product

Branch `feature/living-world-integration` (worktree `D:\4 year\Carbonexo-living`), based on
`feat/carbonexo-living-world@3b13acd` and merged with `feature/living-planet-physics`
(which already contains `feature/cinematic-experience`). Nothing has been pushed, merged into
another branch or deployed.

## The idea in one paragraph

Carbonexo has one Earth. It is the WebGL `LivingEarth` from the cinematic branch, with the
spring-physics camera from the physics branch. A single input, **vitality** (0 = hazed and
degraded, 1 = lush and clear), drives its surface and atmosphere shaders, and the CSS poster
fallback follows the same value. Every screen that shows the planet gets that value from one
engine, `lib/living-world`. The engine always says where the number came from: your logs, a
catalog estimate, a Carbon Twin what-if, the landing story, or a sourced reference.

## Data flow

```
Activity API (14-day history) ─┐
Store: dashboard, profile, plan ┼─► buildLivingWorld() ─► LivingWorldState ─► <PlanetPanel> / <LivingEarth vitality>
Credit ledger (balance, refIds) ┤        (pure, tested)        │
Simulation API ─► setScenario() ┘                              └─► milestones, goal, scenarioVisual
```

- **`lib/living-world/derive.ts`**: pure derivations, covered by tests in `derive.test.ts`.
- **`lib/living-world/LivingWorldProvider.tsx`**: mounted once in `app/app/layout.tsx`. It gathers
  existing data, refetches when the store's aggregates move, and exposes `pulse` (physical
  feedback) and `setScenario` (hypothetical channel).
- **`components/living-world/*`**: `PlanetPanel` (planet + provenance + "why does it look like
  this?"), `ProvenanceBadge`, `WorldBackdrop` (the CSS-only app sky whose horizon follows vitality),
  and `Growth` (a sapling for real progress values).
- **Renderer**: `components/planet/{LivingEarth,EarthCanvas,shaders,EarthPoster}`. Vitality is read
  from a ref every frame and smoothed with `SPRINGS.health`. That spring is critically damped, so
  the planet never reads healthier than the data, even for one frame.

## Honesty rules (enforced in code and tests)

| Rule | Where |
|---|---|
| Planet health follows the **average per logged day** against the UNEP (2020) 1.5 °C lifestyle budget (6.8 kg/day). Logging more often does not change it. | `vitalityForDailyKg`, `deriveVisual`; test "logging more often does not move the planet" |
| Sparse logs pull toward neutral, and the caption says so. | `confidenceFor`, `weighByConfidence` |
| The fixed 8 kg/day "saved" baseline is never used. | Test "does not reference the 8 kg/day savings baseline"; removed from Dashboard, passport and Reports UI |
| Scenarios stay hypothetical and never change `actual`. | `deriveScenarioVisual`; test |
| Milestones come only from persisted logs and the ledger; a replayed completion is not a second milestone. | `deriveMilestones`, `ledgerFacts` |
| Landing vitality is illustrative and labelled that way. | `storyVitality`, ScenePlanet "Planet colour" fact |
| No fabricated sessions, simulations or citations. | `lib/api/auth.ts`, `lib/api/simulations.ts`, coach page; tests |

## Backend changes (additive, no migrations)

- `CreditService.onActionDone` is idempotent per (user, action). `CreditHistoryResponse` gains `refId`.
- Group leaderboard: `co2_saved` (alias `co2_logged`) is the sum of logged emissions, so it now ranks
  **lowest first**; members with no logs rank last. The response shape is unchanged.
- `SimulationItem` accepts `customReplacementLabel` / `customReplacementFactorKgPerUnit`, which the
  Simulate page already sent and which previously failed with a silent 400.

## Merging toward `feat/carbonexo-living-world`

Expect conflicts. When this branch was cut, the primary worktree had **uncommitted** edits by other
sessions to `app/app/page.tsx`, `app/app/coach/page.tsx`, `components/app/ui.tsx`,
`components/AICoachPreview.tsx`, `lib/api/ai.ts` and several backend AI/reward files. This branch
rewrites `app/app/page.tsx` and edits the coach page. Merge those by hand, keeping their behaviour and
this branch's data sources. Do not hand-merge `package-lock.json`; re-run `npm install`.

The two `V10__*.sql` files in the primary worktree still collide. This branch adds no migrations.

## Known limitations

- Performance was checked only in headless Chrome with SwiftShader (CPU). Profile on a real phone
  and GPU before release. Touch devices without capability hints get the CSS poster by design.
- On the backend that was running locally, the coach used the canned provider. Gemini answers were
  not seen.
- The ESG CSV export still contains the backend's "Lifetime CO2 Saved" column (8 kg/day baseline).
  Changing the export format is a contract decision left to the backend owner.
- Two 401s per hard navigation are the existing memory-only access token being refreshed. That
  behaviour is unchanged.
