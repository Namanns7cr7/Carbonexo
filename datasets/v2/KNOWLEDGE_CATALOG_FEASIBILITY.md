# Optional: Publishing the EcoMind OKF Bundle to Google Cloud Knowledge Catalog

**Recommendation: do not enable now.** Revisit when another team or agent inside Google Cloud needs to discover the bundle, and once the connector carries trust and lifecycle fields.

Source: the official connector guide, [`connectors/gcp-knowledge-catalog.md`](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/connectors/gcp-knowledge-catalog.md) in the canonical OKF repo, read 2026-10-17.

## How it works

`kcmd` (from `knowledge-catalog/toolbox/mdcode`, built with npm and run with Bun) pushes `.md` files into a Dataplex EntryGroup, using a custom `okf` aspect type. Git stays authoritative: push on merge, never pull into a tracked bundle.

## Fit against our requirements

| Requirement | Connector today | Impact on EcoMind |
|---|---|---|
| Preserve trust (`verified`) | Not carried. Only `title`, `description`, `tags`, `resource`, `type`, `generated`, `sources` | **Blocker.** A catalog reader could not tell machine-confirmed from unverified |
| Preserve lifecycle (`status`, `stale_after`) | Not carried | **Blocker.** Deprecated and stale concepts would look current |
| Preserve the `carbonexo:` extension (region, factor_id, scientific_status) | Not carried unless `okf-aspect.json` / `okf.ts` are extended | Needs custom work plus a round-trip test |
| Cross-links | Stored verbatim, not resolved | The graph would be lost in the catalog |
| Access control | No entry-level ACL; `roles/viewer` can bulk-export the EntryGroup | Acceptable only because the bundle has no user data (enforced by a test) |
| Scale | Untested beyond a 14-file demo; per-file push; Dataplex quotas | Unknown risk for the full bundle |
| Non-`.md` files | Ignored | The executor/attester code under `references/` would not be published |

## Cost and complexity

- Money: Dataplex catalog metadata and API usage. Pricing was not verified for this report, so it isn't estimated here. It is likely small at this size, but it needs a Pricing Calculator check.
- Complexity: new toolchain (Bun, a kcmd build), a custom aspect type, Dataplex API enablement, push automation in CI, and a round-trip diff gate. That's roughly 2–4 engineering days to do properly, including extending the aspect to carry `verified`, `status`, `stale_after` and `carbonexo`.
- Runtime value to EcoMind: **none.** Retrieval reads `sci_chunks` in Cloud SQL, and the catalog would only serve discovery.

## If you decide to proceed later

1. Extend the aspect with `verified`, `status`, `stale_after` and `carbonexo`, keeping existing index values stable.
2. Push to a **staging** EntryGroup, pull, and require `git diff --exit-code` after one normalisation commit.
3. Gate on: our `okf_validate.py` passing on the pulled copy, and trust tiers / statuses identical before and after.
