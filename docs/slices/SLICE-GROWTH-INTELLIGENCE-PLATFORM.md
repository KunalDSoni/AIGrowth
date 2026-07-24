# SLICE — Growth Intelligence Platform (packaging)

**Cluster prefix:** `GIP`
**Design:** `docs/superpowers/specs/2026-07-24-growth-intelligence-platform-design.md`
**Approach:** A — compose module + endpoint + dashboard over existing engines. No framework/crawler change.

Build order is strict; each epic is independently testable (TDD) and shippable before the next.

| Epic ID | Epic | What it delivers | Depends on | Status |
|---|---|---|---|---|
| **GIP-001** | Report contract & types | `GrowthPillarId`, `PillarSummary`, `GrowthIntelligenceReport` in `lib/domain/types.ts`; fixed 6-pillar order constant. | — | **Done** |
| **GIP-002** | Live→aggregator input adapter | In `growth-intelligence-compose.ts`: map `buildLiveIntelligence(result)` + result's audit issues / recommendations / outcomes into the six typed arrays (`recommendations, auditIssues, opportunities, aiVisibility, citationGaps, outcomes`). | 001 | Done |
| **GIP-003** | Pillar snapshot builder | `buildPillarSnapshot(inputs, live)` → 6 `PillarSummary` using the documented source→pillar map; counts, top signal, evidence, per-pillar labels. | 002 | Done |
| **GIP-004** | Compose orchestrator | `buildGrowthIntelligenceReport(result, options)` — runs adapter → `buildGrowthSignals` → `buildUnifiedGrowthDecisions` → assembles report with guardrails + labels + evidence union; empty-evidence path. | 002, 003 | Done |
| **GIP-005** | API route | `GET /api/growth-intelligence?domain=` following the `/api/opportunities` pattern (loadLatest, 400/409/500 handling, 200 report). | 004 | Done |
| **GIP-006** | Dashboard page | `/demo/growth-intelligence` — 6 pillar cards + ranked decision cards (evidence, whyNow, nextAction, measurement, guardrails); empty "run a scan first" state. | 005 | Done |
| **GIP-007** | Wire-up & docs | Add to demo nav; update `EPIC_STATUS.md` + this slice to Done; note in feature-backlog that Growth Intelligence is now a live surface. | 006 | Done |

**Enhancements 2026-07-24 (post-slice):**
- **Content pillar wired** — `deriveContentOpportunities` maps live search demand → `buildBusinessAwareContentOpportunities`, lighting up the Content pillar. Demand/conversion/competition are labelled directional estimates (never presented as measured).
- **Measured-GEO provenance** — report now carries `geoMeasurement: "measured" | "simulated"` with an honest label; the route runs `measureGeo` only when `OPENGROWTH_ANSWER_ENGINE` is set (default stays offline/simulated, no network in demo).
- **Outcomes deliberately NOT wired** — there is no measured before/after outcome store; wiring `buildOutcomeLearningRecords` would require fabricated scenarios, which the "no fake data" non-negotiable forbids. The Marketing pillar stays honestly empty-with-label until a real outcome store exists.

**Status: shipped 2026-07-24.** All 7 epics done. Verified: 17 new tests green (10 compose + 3 route + 4 view), full suite 324 pass / 2 skip, `typecheck` + `lint` + `build` pass. `/demo/growth-intelligence` live in nav; `GET /api/growth-intelligence?domain=` returns the report; the previously orphaned `growth-intelligence.ts` aggregator is now driven by live evidence.

## Acceptance criteria (slice)

- Aggregator `growth-intelligence.ts` is imported and driven by **live** evidence (no demo signals).
- One endpoint returns a `GrowthIntelligenceReport`; one dashboard renders six pillars + ranked decisions.
- Honesty labels + SEO guardrails + evidence IDs present on the report and visible in UI.
- Unit + route + e2e tests green; `typecheck`, `lint`, `build` pass.

## Non-negotiables (inherited)

No Northstar/demo data in the surface · GEO directional only · search demand crawl-derived until GSC · no guaranteed outcomes · insufficient evidence is stated, not hidden.
