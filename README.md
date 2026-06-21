# Carbonexo — Personal Sustainability Assistant

A smart, context-aware assistant that helps a person **understand and reduce their
carbon footprint**. You log everyday activities (or upload an electricity bill),
and the assistant turns that raw behaviour into personalised, data-grounded advice,
goals, and rewards.

- **Live flow:** sign in → 7-step persona onboarding → daily tracking → dashboard &
  insights → **AI Coach** → action plan → green credits → rewards.

## Live demo

- **App:** https://carbonexo-web-yigbd35s3q-el.a.run.app
- **API:** https://carbonexo-backend-yigbd35s3q-el.a.run.app
- **API docs (Swagger):** https://carbonexo-backend-yigbd35s3q-el.a.run.app/swagger-ui.html

## Documentation

Full docs live in [`docs/`](docs/README.md) — organised into **guides** (run &
deploy), **reference** (architecture, API, database, security), and **project**
(roadmap, audits). Quick links:
[Architecture](docs/reference/ARCHITECTURE.md) ·
[API](docs/reference/API.md) ·
[Database](docs/reference/DATABASE.md) ·
[Security](docs/reference/SECURITY.md) ·
[Deployment](docs/guides/DEPLOYMENT.md)

---

## 1. Chosen vertical

**Sustainability / Climate — a Personal Sustainability Assistant.**

The persona is an everyday individual who wants to live greener but doesn't know
*where* their emissions come from or *what* to change. Carbonexo profiles that
person during onboarding (travel modes, diet, electricity use, shopping habits,
weekly reduction goal) and then acts as their always-on sustainability coach.

---

## 2. The assistant: approach & logic (context-aware decision-making)

The "smart, dynamic assistant" is the **AI Coach + recommendation engine**. It does
not give generic tips — every response is computed from the user's own context:

**Context the assistant builds for each user**
- **Biggest emission source** this week (derived from per-category CO₂ breakdown of
  their activity logs).
- **Trend**: today vs. yesterday delta, 7-day series, streak of consecutive logged days.
- **Persona**: travel mode(s), diet(s), electricity level, shopping habits from onboarding.
- **Progress**: carbon saved so far and weekly-goal completion.

**How it decides**
1. Aggregates the user's logs into a category breakdown and picks the dominant source.
2. Renders a **prompt template stored in the database** (not hardcoded) with that
   context, so the same code adapts per user and templates are editable without redeploys.
3. Routes to a model by need — a higher-quality model for reports/recommendations,
   a faster model for chat/tips (`default-model` vs `fast-model`).
4. **Graceful degradation**: a pluggable AI provider interface means the assistant
   runs with Google Gemini (Vertex AI) in production, or a built-in *canned*
   provider with zero cloud credentials for local/dev — same API, no breakage.
5. The **credit engine** turns reductions into green credits via configurable rules;
   credits unlock rewards — closing the loop from insight → action → reward.

> Example: if *Travel* is the biggest source (e.g. 18 kg this week), the coach and
> the Action Plan surface travel-specific actions (metro, carpool) with their
> estimated weekly savings, and completing them advances the user's goal bar.

Recommendations are filtered to the user's relevant categories, and the dashboard
"AI insight" names the biggest source and links straight to the coach.

---

## 3. How the solution works (architecture)

```
Next.js 14 PWA  ──►  Spring Boot API  ──►  PostgreSQL 16
(App Router)         (Java 17)             (Flyway-managed)
                        │
                        ├─ Auth: JWT access + rotating refresh, Google sign-in
                        ├─ Engines: carbon calc · credit rules · AI (provider-pluggable)
                        └─ Integrations: Gemini (Vertex AI), Cloud Storage, OCR — all
                           behind interfaces with local fallbacks
```

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind + Framer Motion; a
  mobile-first installable PWA. Auth-gated app, login-first routing, onboarding gate.
- **Backend:** layered Spring Boot (controller → service → repository → entity) with
  DTO validation and RFC-7807 error responses.
- **Data:** PostgreSQL with Flyway migrations as the source of truth; emission
  factors, credit rules, rewards and prompt templates are **data, not code**.

---

## 4. Evaluation focus

- **Code quality:** clear layering, single-responsibility services, typed DTOs,
  provider abstractions (`AIProvider`, `OcrProvider`, `BlobStorageService`) so
  business logic has no vendor-specific code.
- **Security:** bcrypt passwords; short-lived JWT access tokens + **rotating refresh
  tokens stored only as SHA-256 hashes**; Google ID tokens verified against Google's
  keys (signature, expiry, audience); CORS locked to known origins; errors never leak
  internals; **no secrets in the repo** — everything via env / Secret Manager.
- **Efficiency:** config-driven engines (no hardcoded factors), hot-query DB indexes,
  fast/quality model split, Next.js standalone build, Cloud Run scale-to-zero.
- **Accessibility:** semantic, keyboard-navigable UI; `prefers-reduced-motion`
  guards on all animations; light/dark themes; mobile-first responsive layout.
- **Testing:** automated unit tests on the core logic — **backend JUnit** (JWT
  issue/verify, Google ID-token verifier, carbon calculation, file-upload
  validation, prompt rendering, profile/config/credit/reward services, RFC-7807
  error handling) via `mvn test` (**62 tests**), and **frontend Vitest** on the
  carbon helpers, domain catalog, and every API client module via `npm test`
  (**44 tests**) — **106 passing in total**, with a clean `tsc --noEmit` typecheck
  and zero ESLint warnings. The full API is also explorable via Swagger UI at
  `/swagger-ui.html`.

---

## 5. Run locally

Prereqs: Docker, JDK 17, Maven, Node 18+.

```powershell
# 1. Database
docker compose -f database/docker-compose.yml up -d

# 2. Backend (from backend/)
cd backend
$env:AI_PROVIDER="canned"   # no cloud creds needed
java -jar target/ecotrack-backend-0.1.0.jar   # or: mvn spring-boot:run

# 3. Frontend (repo root)
npm install
npm run dev
```

Open **http://localhost:3000**. Demo login: `yash@ecotrack.dev` / `password`
(after loading `database/seed.sql`). Swagger: http://localhost:8080/swagger-ui.html

To enable real Google sign-in or Gemini, set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_ID` and `AI_PROVIDER=gemini` (see `.env.example`).

---

## 6. Deploy to Google Cloud

Cloud Run (frontend + backend) + Cloud SQL, one script. See **[DEPLOYMENT_GCP.md](DEPLOYMENT_GCP.md)**.

---

## 7. Assumptions

- **Brief = spec.** No formal PRD was provided, so the product brief is treated as
  the authoritative requirements source.
- **Emission factors are representative defaults** (seeded from a public-style factor
  table) rather than region-certified values; they live in the DB so they can be
  tuned per region without code changes.
- **AI is optional for grading.** The app ships an offline `canned` AI provider so it
  runs and demos fully **without** any cloud credentials; Gemini is a config flip.
- **Single-user personal assistant** scope (no org/multi-tenant features).
- **Local/dev uses a stub blob store**; production uses Google Cloud Storage.
- Multi-select onboarding answers are stored comma-separated (the persona can use
  several travel modes / diets).

---

## 8. Tech stack

Next.js 14 · TypeScript · Tailwind · Framer Motion · Java 17 · Spring Boot 3.3 ·
Spring Security (JWT) · PostgreSQL 16 · Flyway · Google Gemini (Vertex AI) ·
Cloud Run · Cloud SQL · Docker.
