# Agent coordination — Carbonexo

Living record of who is working where. Update it when ownership or status changes.

_Last updated: 2026-10-16_

## 1. Branches and baseline

| Item | Value |
|---|---|
| Repository | https://github.com/Namanns7cr7/Carbonexo |
| This workstream | `feature/cinematic-experience` (worktree `D:\4 year\Carbonexo-cinematic`) |
| Baseline | `487e4ee` on `feat/carbonexo-living-world` — Chapters 2–6 of the scroll story, committed immediately before branching, at the user's direction |
| Baseline lineage | `feat/carbonexo-living-world` = `origin/sak@b8b4be2` merged (`fb62319`) + living-world Phases 1–2 |
| `sak` | Exists. `origin/sak` is at `1c69e0d` ("Simplify Simulate page", 2026-10-15 22:31). **One commit ahead of this baseline** — see §6. |
| `main` | `878500d`. Not touched. |
| Other worktrees | `D:\4 year\Carbonexo` → `feat/carbonexo-living-world` (primary) |

**Why not branch from `sak`?** The brief allowed choosing a baseline. The cinematic work builds on the motion-tier system (`lib/motion.ts`, `lib/useMotionTier.ts`) and sits next to the scroll story, and neither exists on `sak`. The user chose this baseline explicitly.

Nothing in this workstream has been pushed, merged or rebased. No destructive git commands were run.

## 2. Agents and responsibilities

The "Agent 1 / Agent 2" brief assumed another coding agent was active in this repo. Phase 0 found otherwise:

| Actor | What it is | Where it works | Status |
|---|---|---|---|
| **Agent 2 (this session)** | Cinematic experience: planet, story landing, impact visualizations, credit vault | `feature/cinematic-experience` worktree | Active |
| **`sak` line** (commits by `sakshi-0519`) | App-screen redesigns: Dashboard, Track, Simulate, Score, Reports | `origin/sak` | Active: last commit 2026-10-15 22:31 |
| **Local session `admin-ce`** | Machine administration on `C:\Users\Admin` | Not in this repo | Confirmed by message: owns no Carbonexo files, will not touch either worktree |
| **`feat/carbonexo-living-world`** | Living-world foundation + scroll story (`/welcome`) | Primary worktree | Committed through `487e4ee`; paused while this workstream runs |

So **Agent 1, for integration purposes, is whoever owns the `sak` app screens.** No agent task files exist (`tasks/plan.md` and `tasks/todo.md` date from June and predate both lines). There were no open PRs to check: the `gh` CLI isn't installed, so this was not verified against GitHub.

## 3. Ownership

### Owned by Agent 2: create and modify freely

```
components/experience/      cinematic landing sections
components/planet/          Living Earth (WebGL + CSS fallback), CO₂ panel
components/visualizations/  impact + vault components (props only)
lib/experience/             geo, sun, data, types, fixtures, viz helpers, media registry
public/experience/          earth textures; generated/ for AI media
scripts/experience/         generate-media.mjs
app/experience/             NEW preview routes only (/experience, /experience/components)
docs/agent-coordination.md
docs/experience-integration.md
```

### Shared, touched by Agent 2 in this branch

| File | Change | Why |
|---|---|---|
| `package.json` / `package-lock.json` | + `three@0.169.0`, `@react-three/fiber@8.18.0`, `@react-three/drei@9.122.0`, dev `@types/three@0.169.0` | Required for the WebGL globe. Pinned exact versions; fiber 8 / drei 9 because the app is on React 18. **Likely merge conflict with `sak` lockfile — see §6.** |

### Not touched (Agent 1 / existing owners)

Auth, `backend/`, `lib/api/*`, `lib/store.tsx`, `lib/carbon.ts`, `app/app/*` screens, `app/welcome`, `app/layout.tsx`, `app/globals.css`, `tailwind.config.ts`, `components/app/*`, `components/chapters/*`.

## 4. Active work

| Area | State |
|---|---|
| Living Earth (WebGL) | Done: day/night lit by the real subsolar point, clouds, atmosphere, water glint, orbit and zoom, camera flights, CO₂ markers |
| No-WebGL / reduced-motion path | Done: CSS globe from the same NASA imagery, plus the text data panel |
| Story landing (`/experience`) | Done as a preview route. **Not** mounted on `/` or `/welcome` |
| Impact visualizations | Done: Daily footprint, Weekly progression, Reductions, Goal, Actions, Impact Passport |
| Carbon Credit Vault | Done: UI only. No backend exists for certified credits (§5) |
| Generated media | Pipeline done (dry run verified). **No assets generated**: needs `MUAPI_API_KEY` from the user |

## 5. Shared contracts and integration points

- **Component props**: `lib/experience/types.ts`. Every visualization is props-in; no component fetches or hardcodes user metrics.
- **Fixtures**: `lib/experience/fixtures.ts`. Previews only. Vault fixtures use `Sample Registry` / `SAMPLE-` IDs and a test enforces it.
- **Motion tiers**: consumes `useMotionTier()` / `lib/motion.ts` read-only. No changes to them.
- **Theme tokens**: consumes `--lime`, `--surface`, `--canopy`, `--mint` etc. read-only.
- **Green Points vs certified credits**: Green Points map to the existing `credit_ledger` balance (in-app reward). Certified credits have **no backend** today: a `CertifiedCredit` / `RetirementRecord` API (registry IDs, serial ranges, vintage, retirement records) needs to be designed by the backend owner before the vault shows anything but an empty state. Agent 2 has not added endpoints.

Integration steps and data mapping: **`docs/experience-integration.md`**.

## 6. Blockers and handoff notes

1. **`origin/sak` moved after this baseline** (`1c69e0d` touches only `app/app/simulate/page.tsx`). No overlap with Agent 2 files. Merging this branch toward `sak` will need that commit, plus the lockfile resolved by re-running `npm install`. Do not hand-merge `package-lock.json`.
2. **Generated media is blocked on a key.** Set `MUAPI_API_KEY` in the shell (never in a file in the repo), dry-run, then `--run`. Review assets before committing them.
3. **Certified-credit backend** does not exist (§5). The vault renders its empty state until it does.
4. **`/experience` is a preview.** Replacing the public landing is a product decision for the user, not something to do in a merge.
5. **The deploy caveat in `IMPLEMENTATION_PLAN.md` still applies.** Cloud Build mis-compiles the root layout, so verify with a local production build before any deploy.

## 7. Log

| When (2026-10-15) | Who | What |
|---|---|---|
| ~22:50 | Agent 2 | Phase 0 audit; messaged `admin-ce`; it confirmed no involvement in this repo |
| ~22:55 | Agent 2 | Committed `487e4ee` on `feat/carbonexo-living-world` (user-approved); created worktree + `feature/cinematic-experience` |
| ~23:00–23:40 | Agent 2 | Implemented planet, experience, visualizations, vault, media pipeline; checks + screenshots |


---

## 8. Workstream: `feature/living-planet-physics` (2026-10-16)

| Item | Value |
|---|---|
| Branch | `feature/living-planet-physics` |
| Worktree | `D: year\Carbonexo-physics` |
| Base | `fdcd79e` (`feature/cinematic-experience`) + merge of `origin/sak@1c69e0d` |
| Old-UI reference | `D: year\Carbonexo-old` — **detached** at `origin/sak@1c69e0d`, read-only, used to run and screenshot the original UI |
| Pushed / merged | Nothing. Not pushed, not merged into `sak` or `main`. |

### Active work observed elsewhere — not touched

At the start of this workstream the primary worktree (`D: year\Carbonexo`, `feat/carbonexo-living-world`) gained **uncommitted** edits to `app/app/page.tsx` and `app/globals.css` (Dashboard being restored to the "clean white card, original style"). Someone is actively working there. This branch therefore:

- does **not** modify `app/app/page.tsx`, `app/globals.css`, `tailwind.config.ts`, `app/layout.tsx`, `lib/store*`, `lib/api/*` or `backend/`;
- scopes its dark tokens in `components/journey/journey.module.css` instead of editing `globals.css`.

### Owned by this workstream

```
lib/physics/                spring.ts, globe.ts (+ tests) — springs, inertia, globe camera body
components/physics/         MagneticButton, TactileCard, InertialRail, Celebrate
components/journey/         PlanetJourney + five scenes (the new /welcome)
lib/experience/grid.ts      Ember/OWID grid intensity (new)
lib/experience/trips.ts     example routes + estimates (new)
lib/experience/journey.ts   scroll → camera path (new)
docs/living-planet.md
```

### Shared files changed (review these)

| File | Change |
|---|---|
| `components/planet/EarthCanvas.tsx` | OrbitControls + eased flights replaced by the GlobeBody physics rig; grid layer; route arcs; spring-grown markers; view-offset framing |
| `components/planet/LivingEarth.tsx` | New props (`anchorRef`, `layer`, `route`, `zoomable`); keyboard control; zoom buttons. Old props (`region`, `selectedIso`, `showCo2`) still work |
| `components/planet/shaders.ts` | Atmosphere rewritten (exact limb glow — removes the hard outer ring and the dark gap); tighter sun glint |
| `lib/experience/co2.ts` | + `WORLD_CO2_PER_CAPITA` (OWID, 2024) |
| `app/welcome/page.tsx` | Mounts `<PlanetJourney />` instead of the chapters. Chapter components left in the tree, unmounted |
| `app/app/actions/page.tsx` | Spring press + one-shot `Celebrate` when a plan action is completed. Progress still goes through the existing `togglePlan` |

### Handoff to the Dashboard owner

The Dashboard currently uses the CSS `RotatingGlobe`. A drop-in physics globe is available — **not wired in by this branch** because `app/app/page.tsx` is being edited elsewhere:

```tsx
import { LivingEarth } from '@/components/planet/LivingEarth';
<LivingEarth className="h-[160px] w-[160px] overflow-hidden rounded-full" interactive label="Earth, lit as it is right now." />
```
It falls back to the CSS poster on reduced motion / weak devices / no WebGL, and unmounts its GL context when off screen.
