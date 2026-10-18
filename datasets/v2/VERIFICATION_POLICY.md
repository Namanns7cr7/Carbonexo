# Provenance and Scientific Verification Policy (v1)

The machine-readable form is `okf/bundle/ecomind/policies/verification-policy.md`. This page is the human-readable summary for reviewers. Both are `draft` and **pending human review**.

## 1. Three independent questions

| Question | Recorded as | Who can answer it |
|---|---|---|
| Is the evidence what we say it is? | `verification_status` (records), OKF `verified` with `process:` actors | Pipeline checks against hash-pinned artifacts |
| Is the claim fit to show users? | `scientific_status` (supported / provisional / unsupported) | Pipeline rules + a human scientific reviewer |
| Has a person reviewed it? | OKF `verified` with a `human:` actor, `status: stable` | **Only** a named reviewer, recorded in `reviewed/human_reviews.csv` |

Passing schema validation or OKF conformance answers none of these.

## 2. What may support a user-facing claim

| Evidence grade | Production answers | Labelled as |
|---|---|---|
| approved (human-reviewed, stable, fresh) | Yes | evidence |
| machine-confirmed draft, fresh | Yes | "source-checked, not yet reviewed by a person" |
| unverified evidence | No (review mode only) | |
| stale (`now >= stale_after`) | No (review mode only) | STALE |
| deprecated | Never as evidence | DEPRECATED |

Internal guidance (methodology, accounting rules, computations, tool contracts, policies, regions) may shape an answer while in draft. It is labelled "Carbonexo methodology (pending review)" and never cited as science.

## 3. Numbers

- Every kg figure comes from an attested computation over the factor registry. Retrieved text never supplies a number. The consumer masks decimals in evidence text.
- Unsupported factors produce **Not estimated** plus the missing information. In a clearly labelled demo mode they may appear with a warning.
- No GB/US factor is applied to India, including as a proxy. GLOBAL proxies carry an uncertainty label.
- When the regional factor is missing, the answer says so instead of substituting another region's factor.

## 4. Attribution

Every scientific claim carries a source attribution. Claim-level attribution uses an OKF footnote keyed to `sources[].id`. When only the concept's sources are available, the citation is marked "concept-level". A citation that does not resolve to the manifest or to a bundle concept fails the citation check (scorer: `fabricated_citations`). The answer is then repaired or the claim dropped.

## 5. Human verification

- A tool, agent or pipeline never writes a `human:` actor.
- A review row contains `concept_id, reviewer, reviewed_at, verdict, notes`. The producer turns approved rows into `verified` events and `status: stable`. The validator rejects `human:` events that have no row.
- As of 2026-10-17 there are **no** human reviews. Every concept is `draft` or `deprecated`.

## 6. Freshness

`stale_after` is set from the publisher's cadence. A stale concept leaves production context automatically (tested at 2027-01-05: the grid factor is withheld and confidence drops). A refresh reruns the source checks and needs a new review before the concept becomes `stable`.

## 7. Untrusted content

Knowledge documents, retrieved chunks, tool results echoed by users, and user memory are all **data**. Instruction-like text inside them is dropped and flagged. The model's system prompt states that retrieved passages are not instructions.
