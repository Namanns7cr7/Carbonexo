# Integrating the cinematic experience

For whoever owns the app screens (Agent 1 / the `sak` line). Everything here mounts without changing business logic: components take props, and the adapters in `lib/experience/adapters.ts` map existing store and API shapes onto them.

Preview everything first:

- **`/experience`**: the full cinematic landing
- **`/experience/components`**: every visualization and the vault, in data / loading / empty states, with SAMPLE fixtures

Both are new, noindexed routes. No existing route was changed.

---

## 1. Living Earth

```tsx
import { LivingEarth } from '@/components/planet/LivingEarth';

<LivingEarth className="h-[420px] w-full" />
```

| Prop | Default | Notes |
|---|---|---|
| `region` | `OVERVIEW` | Any `Region` from `lib/experience/regions.ts`; changing it flies the camera |
| `interactive` | `false` | Drag to orbit and zoom. **Leave off when the globe sits under scrolling content on touch screens**: OrbitControls captures one-finger drags |
| `showCo2` | `false` | Real per-person CO₂ markers (OWID / Global Carbon Project) |
| `selectedIso` / `onSelectCountry` | — | Controlled selection; pair with `<Co2Panel>` |
| `label` | generic | Accessible description, since the canvas itself is `aria-hidden` |
| `credit` | `false` | Imagery credit line (NASA, composite, not live) |

**Behaviour it handles for you:**
- Falls back to a CSS globe built from the same imagery at the `lite` and `still` tiers, when WebGL is missing, if the GL context is lost, or if rendering throws.
- Pauses rendering when off screen or when the tab is hidden.
- Unmounts the WebGL context when it's far from the viewport, so several globes on a page don't each hold GPU memory.
- three.js is loaded with `next/dynamic` (`ssr: false`): about 220 kB gzipped, fetched only on routes that render a globe.

**Sizing:** give the wrapper an explicit height or an aspect ratio. The globe frames itself to the container's shape.

**Day/night is real:** lighting comes from `subsolarPoint()` for the current time, refreshed every minute. Don't describe the clouds or imagery as live. They are a NASA composite, and the credit line says so.

## 2. CO₂ data panel

```tsx
const [iso, setIso] = useState<string | null>(null);
<LivingEarth showCo2 interactive selectedIso={iso} onSelectCountry={setIso} />
<Co2Panel selectedIso={iso} onSelect={setIso} />
```

The panel is the accessible, keyboard-usable version of the markers, and the whole overlay when WebGL is unavailable. To update the data, follow the comment at the top of `lib/experience/co2.ts`.

## 3. Impact visualizations: mapping from `useCarbon()`

```tsx
import { useCarbon } from '@/lib/store';
import { DailyFootprint, WeeklyProgression, ActionCompletion, ReductionEstimates } from '@/components/visualizations';
import { toDailyFootprint, toWeeklySeries, toActionItems, toReductions } from '@/lib/experience/adapters';

const c = useCarbon();
const loading = !c.hydrated;

<DailyFootprint loading={loading} data={toDailyFootprint(c.todayKey, c.todayTotal, c.todayBreakdown)} />
<WeeklyProgression loading={loading} series={toWeeklySeries(c.weekTotals)} />
<ActionCompletion loading={loading} actions={toActionItems(c.plan)} onToggle={(id) => c.togglePlan(id)} />
<ReductionEstimates loading={loading} items={toReductions(c.plan)} />
```

| Component | Source | Not available from existing data |
|---|---|---|
| `DailyFootprint` | `todayKey`, `todayTotal`, `todayBreakdown` | `goalKg` is optional. The app has `profile.weeklyGoalPct` (a % reduction), not a daily kg target. Pass one only if the product defines it |
| `WeeklyProgression` | `weekTotals` | — |
| `ActionCompletion` | `plan` (+ `togglePlan`) | — |
| `ReductionEstimates` | completed `plan` rows | Catalog savings are **estimates** and are labelled `estimate`. Use `basis: 'measured'` only for a reduction computed from logs |
| `GoalProgress` | — | Needs `budgetKg` for a period. No such field exists today. Don't derive one from `weeklyGoalPct` without a product decision on the baseline |
| `ImpactPassport` | `streak`, `completedCount`, `totalSaved`, `profile.name` | `memberSince` and stamp eligibility aren't stored anywhere. The component displays stamps; it never decides who earned them |

All components accept `loading` and render an honest empty state for new users. None has a default metric.

## 4. Carbon Credit Vault

```tsx
import { CarbonCreditVault } from '@/components/visualizations';
import { toGreenPoints, pointsEarnedThisMonth } from '@/lib/experience/adapters';
import { getBalance, getHistory } from '@/lib/api/credits';

const [bal, hist] = await Promise.all([getBalance(), getHistory()]);
<CarbonCreditVault
  points={toGreenPoints(bal, pointsEarnedThisMonth(hist))}
  credits={[]}       // no certified-credit backend yet → empty state
  retirements={[]}
/>
```

**The rule:** `credit_ledger` "credits" are **Green Points**, Carbonexo's in-app reward. They are shown as points with a notice that they are not carbon credits. Certified credits (registry, project ID, vintage, serial range, tonnes) are a different type (`CertifiedCredit`). No code path converts or sums one into the other. Keep it that way. Calling ledger points "carbon credits" in the UI would misrepresent them.

**Backend needed before the vault shows certified credits:** endpoints returning `CertifiedCredit[]` and `RetirementRecord[]` (shapes in `lib/experience/types.ts`), sourced from a real registry integration or a verified purchase record. Retirement happens at the registry; the UI only displays the result. This work belongs to the backend owner.

## 5. The cinematic landing

```tsx
import { ExperienceLanding } from '@/components/experience';
export default function Page() { return <ExperienceLanding ctaHref="/onboarding" />; }
```

Or recompose from the individual sections: `CinematicHero`, `RegionTour`, `PlanetData`, `ImpactPreview`, `MediaSlot`.

`/welcome` currently renders the six-chapter scroll story from `feat/carbonexo-living-world`. Whether `/experience` replaces it, merges with it, or replaces only the opening chapter is a **product decision for the user**. It isn't done in this branch.

## 6. Generated media (optional)

Slots: `interlude-canopy` (image) and `cta-dawn` (video). Until they're filled, the sections render their own scenes.

```bash
node scripts/experience/generate-media.mjs                  # dry run: shows prompts, sends nothing
export MUAPI_API_KEY=…                                      # your muapi.ai key, in the shell only
node scripts/experience/generate-media.mjs --run            # paid: generates, downloads, records
```

Outputs go to `public/experience/generated/` and `lib/experience/generated-media.json`, with the model, prompt and date. They render with an "AI-generated illustration" label. Review each asset before committing it.

## 7. Credentials and services

| Need | Required? | Where |
|---|---|---|
| `MUAPI_API_KEY` | Only for generating media | Shell environment. Never commit it, never put it in `NEXT_PUBLIC_*` |
| Map or tile API keys | No | Textures are local static files |
| New backend services | Only for certified credits (§4) | — |

## 8. Merge notes

- Dependencies added: `three@0.169.0`, `@react-three/fiber@8.18.0`, `@react-three/drei@9.122.0`, `@types/three@0.169.0` (dev). If `package-lock.json` conflicts, take either side and re-run `npm install`. Don't hand-merge it.
- No changes to `app/globals.css`, `tailwind.config.ts` or `app/layout.tsx`. The poster's animation lives in `components/planet/planet.module.css`.
- `npm run typecheck && npm run lint && npm test && npm run build` must pass after the merge.
