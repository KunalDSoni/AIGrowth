# Capability Registry

Per `opengrowth-engine-blueprint/00-governance/CRITICAL_PRE_DEVELOPMENT_ADDENDUM.md` §1.
Each capability is classified as `COMPLETE`, `FUNCTIONAL_BUT_INCOMPLETE`, `UI_ONLY`,
`MOCK_ONLY`, `PARTIALLY_IMPLEMENTED`, `BROKEN`, `DUPLICATED`, `NOT_STARTED`, or
`NOT_CURRENTLY_REQUIRED`. "The code is the source of truth" — this table is kept in
sync with `lib/engines/*` and the demo dataset, not aspirations.

## Legend

- **COMPLETE** — implemented, tested, and wired into the demo.
- **FUNCTIONAL_BUT_INCOMPLETE** — works and tested, but real-data adapters pending.
- **MOCK_ONLY** — deterministic simulated data; contract ready for a real provider.

## Evidence & Provenance

| Capability | Epic | Status | Location |
|---|---|---|---|
| Evidence model with provenance/reliability/freshness | EVID-001 | COMPLETE | `lib/domain/types.ts`, `lib/data/demo.ts` |
| Evidence classification (strength/provenance/freshness) | EVID-002 | COMPLETE | `lib/engines/evidence.ts` |
| Evidence drawer UI | EVID-002 | COMPLETE | `components/evidence-drawer.tsx` |

## Business Understanding

| Capability | Epic | Status | Location |
|---|---|---|---|
| Business knowledge graph (entities + relationships) | BIZ-001 | COMPLETE | `lib/engines/business-graph.ts` |
| Assumption confirm/reject/edit workflow | BIZ-002 | COMPLETE | `lib/engines/business-graph.ts` |

## Crawl & Website Intelligence

| Capability | Epic | Status | Location |
|---|---|---|---|
| Secure single-page crawl (SSRF-safe) | CRAWL-001 | COMPLETE | `lib/providers/crawler.ts`, `lib/security/url.ts` |
| Deep HTML rule engine | CRAWL/TSEO | COMPLETE | `lib/seo-engine/**` |
| Site inventory + page classification | CRAWL-002 | COMPLETE | `lib/engines/site-inventory.ts` |

## Technical SEO

| Capability | Epic | Status | Location |
|---|---|---|---|
| Deterministic technical audit rules | TSEO-001 | COMPLETE | `lib/engines/technical-audit.ts`, `lib/seo-engine/rules/**` |
| AI-bot accessibility audit (robots/sitemap) | TSEO-002 | COMPLETE | `lib/engines/ai-access.ts` |

## Search & Content Opportunity

| Capability | Epic | Status | Location |
|---|---|---|---|
| Search-backed opportunity discovery | SEARCH-001 | COMPLETE | `lib/providers/search.ts`, `lib/engines/demand-proxy.ts`, `lib/engines/content-gap.ts` |
| Search Console / keyword provider adapters | SEARCH-001 | COMPLETE | `lib/providers/search.ts` (`GSC_*`, `KEYWORD_PROVIDER_*`) |
| Intent / funnel / topic-cluster engine | SEARCH-002 | COMPLETE | `lib/engines/search-intent.ts` |
| GSC-ready content inventory | CONTENT-001 | COMPLETE | `lib/engines/content-inventory.ts` |
| Content quality & refresh engine | CONTENT-002 | COMPLETE | `lib/engines/content-inventory.ts` |

## AI Visibility

| Capability | Epic | Status | Location |
|---|---|---|---|
| Prompt family + variant generator | AIV-001 | COMPLETE | `lib/engines/prompt-variants.ts` |
| Timestamped observation run lifecycle (status/cost/variance) | AIV-002 | COMPLETE | `lib/engines/observation-run.ts` |
| Mention/sentiment/variability metrics | AIV-003 | COMPLETE | `lib/engines/ai-visibility.ts` |

## Citation Intelligence

| Capability | Epic | Status | Location |
|---|---|---|---|
| Citation extraction + domain classification | CITE-001 | COMPLETE | `lib/engines/citation-intelligence.ts` |
| Citation gap → action (sample-size gated) | CITE-002 | COMPLETE | `lib/engines/citation-gap.ts` |

## Competitor Intelligence

| Capability | Epic | Status | Location |
|---|---|---|---|
| Competitor type/coverage model | COMP-001 | COMPLETE | `lib/engines/competitor-intelligence.ts` |
| Competitor prompt/citation gap analysis | COMP-002 | COMPLETE | `lib/engines/competitor-intelligence.ts` |
| Live competitor homepage crawl compare | COMP-001 | COMPLETE | `lib/engines/competitor-crawl.ts`, `app/api/competitors` |

## Recommendation Intelligence

| Capability | Epic | Status | Location |
|---|---|---|---|
| Unified recommendation candidate bus | REC-001 | COMPLETE | `lib/engines/recommendation-bus.ts` |
| Transparent next-best-action ranking + buckets | REC-002 | COMPLETE | `lib/engines/recommendation-bus.ts`, `lib/engines/priority.ts` |

## Content Generation & Review

| Capability | Epic | Status | Location |
|---|---|---|---|
| Evidence-grounded brief builder | GEN-001 | COMPLETE | `lib/engines/brief-builder.ts` |
| Claim-safe draft generation + approval | GEN-002 | COMPLETE | `lib/engines/brief-builder.ts` |

## Orchestration & Learning

| Capability | Epic | Status | Location |
|---|---|---|---|
| Recommendation-to-campaign workflow | ORCH-001 | COMPLETE | `lib/engines/campaign.ts` |
| Outcome measurement + attribution caveats | LEARN-001 | COMPLETE | `lib/engines/outcome-learning.ts` |

## Agentic Marketing & CRO (Epic 3)

| Capability | Epic | Status | Location |
|---|---|---|---|
| Thompson Sampling bandit + sticky routing | MAB-001 | COMPLETE | `lib/bandit/*`, `app/api/bandit/*` |
| SDR lead enrich pipeline (demo prospects) | SDR-001 | COMPLETE | `lib/engines/sdr-lead-pipeline.ts`, `app/api/sdr/jobs` |
| Audit report HTML/PDF artifact store | SDR-002 | COMPLETE | `lib/engines/audit-report.ts`, `lib/storage/object-store.ts` |
| Google Places / Redis / remote object store | SDR/MAB | FUNCTIONAL_BUT_INCOMPLETE | Adapters stubbed until keys configured |

## Quality Gates

| Capability | Status | Location |
|---|---|---|
| Intelligence evaluation harness | COMPLETE | `tests/eval/intelligence.eval.test.ts` |
| Anti-spam / unsupported-claim guardrails | COMPLETE | `lib/engines/growth-intelligence.ts`, `lib/engines/brief-builder.ts` |

## Not Currently Required

Billing, plugin marketplace, broad integrations, decorative dashboards, generic
chatbot, and generic AI article writing are intentionally `NOT_CURRENTLY_REQUIRED`
(see `V2_INDUSTRY_GRADE_EPICS.md` "What Not To Build Yet").
