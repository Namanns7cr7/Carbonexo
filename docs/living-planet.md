# Living Planet — physics engine and landing journey

Branch `feature/living-planet-physics`. Read with `docs/agent-coordination.md` §8.

## What changed, in one paragraph

`/welcome` is now one continuous journey over a single real-time Earth. The page keeps the original Carbonexo identity from the `sak` line (Logo, navbar, Bricolage two-tone headline, lime CTA, the dashboard card cluster, the swap card, the lime gradient final CTA). It places them over the NASA-textured WebGL globe from `feature/cinematic-experience`. The globe's camera is now a physical body: it springs, it carries momentum, and it obeys friction. Scrolling moves the camera along a path, and dragging moves the planet. Every number on the page is either the visitor's own data (when signed in) or sourced and labelled.

## Why the old UI was better, and what was recovered

| Old (`sak`) strength | Where it lives now |
|---|---|
| Clear product promise, confident two-tone headline | Scene 1 hero ("Your choices shape **tomorrow.**"), same type and colour system |
| The dashboard card that *shows the product* | Scene 3: ring, category bars, chips, bar strip, plus the Insight and Carbon Swap cards |
| Lime brand colour, Bricolage + Manrope, ring-and-leaf logo | Kept. The cinematic branch's mint palette is dropped |
| Navbar with scroll-progress bar and active-section highlight | `JourneyNav` in `PlanetJourney.tsx` |
| The lime gradient "Small actions. Real impact." closing card | Scene 5 |

What was **not** recovered:
- The old hero's invented stats (120k trackers, 2.4M kg, 4.9★). They are replaced by three true facts.
- The hardcoded dashboard numbers. The card is now driven by real data, or by a labelled example.

## Architecture

```
lib/physics/spring.ts      stepSpring (semi-implicit, sub-stepped), decay, rubberBand, nearestAngle, SPRINGS
lib/physics/globe.ts       GlobeBody — follow / drag / free modes sharing one velocity
lib/experience/journey.ts  5 keyframes · storyPosition(scroll) · blend · portraitScale
components/planet/EarthCanvas.tsx  PhysicsRig binds GlobeBody to the camera + pointer; layers; routes
components/planet/LivingEarth.tsx  fallbacks, keyboard control, zoom buttons, anchorRef API
components/journey/*        PlanetJourney (orchestrator) + 5 scenes + useJourneyData
components/physics/*        MagneticButton, TactileCard, InertialRail, Celebrate
```

**Scroll path.** On scroll, `PlanetJourney` writes the interpolated keyframe into `anchorRef.current`; it does not set state. The rig reads the anchor every frame and springs toward it, so React never re-renders per scroll. Scroll stays native, with no scroll-jacking.

**Drag.** The angle per pixel equals the size of one pixel at the globe's near surface, so the point under the finger stays under the finger. On release, the measured velocity glides under friction (1.6/s) and winds back up to the scene's idle drift. A drag holds until the next scene, because the anchor key changes per scene. On touch, only horizontal drags spin the planet; vertical stays page scroll (`touch-action: pan-y`).

**Framing.** The planet slides across the frame through `camera.setViewOffset`, not by moving the camera, so perspective never changes. Portrait viewports back the camera off by `1/aspect`.

## Data on the planet

| Layer | Source | Notes |
|---|---|---|
| CO₂ per person | OWID / Global Carbon Project, 2024, CC BY 4.0 | Existing `co2.ts`; world average 4.7 t added |
| Electricity grid | Ember via OWID, lifecycle gCO₂e/kWh, 2025 (SAU, IDN 2024), CC BY 4.0 | New `grid.ts`, 24 countries |
| A journey | Real city coordinates; great-circle km × the Track screen's per-km factors | Labelled as a lower bound for ground modes |

## Integration steps

1. Review `docs/agent-coordination.md` §8 for the shared files that changed.
2. Merging toward `sak`: `package-lock.json` already carries three/R3F from the cinematic branch. If it conflicts, re-run `npm install`; do not hand-merge it.
3. Dashboard globe (optional, owner's call): see the drop-in in coordination §8.
4. Verify with a local `npm run build`, not Cloud Build (see `IMPLEMENTATION_PLAN.md`).

## Known limitations

- **Performance numbers are not from a GPU.** Browser checks ran in headless Chrome with SwiftShader (CPU rendering), where frames took 80–480 ms. That is no signal for real devices. Profile on real hardware before release.
- **Mobile WebGL tier:** `useMotionTier` sends touch devices without capability hints, and anything with ≤4 cores, to the static poster. Many phones will see the poster rather than the 3D planet. That is deliberate and unchanged.
- **Signed-in path.** The journey's signed-in view (real footprint, real passport stamps) is implemented, typechecked and wired to `useCarbon()`. It was **not** browser-tested, because no test account was used.
- **Higgsfield / generated media:** not used. The cinematic branch's media pipeline is still blocked on a key, and nothing on this page depends on generated video.
- **Passport stamps** are computed from current totals. Earn dates aren't shown because the store has no per-milestone timestamps.
- The chapter components (`components/chapters/*`) are no longer mounted. They are left in the tree so the change is easy to review or revert.

## Screenshots

These are in `docs/living-planet-screenshots/`. All were captured with headless Chrome (SwiftShader) via Playwright against this branch's **production build** (`npm run build && next start`); the "before" captures came from dev servers of the respective commits.

- `before-old-sak-welcome-1440` — `origin/sak@1c69e0d`, the original landing
- `before-living-world-welcome-1440` — the six-chapter scroll story (cartoon CSS planet)
- `before-cinematic-experience-1440` — `/experience` preview (real Earth; hard atmosphere ring, headline collision, mint palette)
- `after-*` — this branch at 1440 / 768 / 390 and under reduced motion
