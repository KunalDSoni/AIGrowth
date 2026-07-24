# SLICE — GEO Influence Loop (GIL)

**Cluster prefix:** `GIL`
**Thesis:** Measuring AI visibility is now a commodity ($29–295/mo, 6+ rivals, 17-engine
coverage). The undefended frontier — and OpenGrowth's product thesis (Sense→Judge→
Package→Act→Learn) — is the **closed causal loop**: go from *"why aren't we cited"* to a
*published change* to a *causally-measured citation lift*, with a human gate. GIL makes
OpenGrowth **the only GEO tool that moves the needle and proves it moved.**

Build order is strict where a dependency exists. Each epic is its own
spec → plan → TDD-build → ship cycle, independently testable and shippable.

## Stage A — Diagnose (per-prompt citation root cause)

| Epic ID | Epic | Delivers | Depends | Reuses | Status |
|---|---|---|---|---|---|
| **GIL-01** | Per-prompt citation ledger | Per-prompt record: brandMentioned vs brandCited vs absent vs unanswered + per-prompt cited competitor sources. Pure derivation, no store. | — | prompt universe, `measureGeo`, `GeoResult` | **Done** |
| **GIL-02** | Cited-source feature extraction | For cited sources, extract what they have (structured pricing, FAQ schema, comparison table, entity clarity, freshness, direct answer). | 01 | OSI/MDM crawl, Lighthouse | **Done** |
| **GIL-03** | Brand-page gap diff | Diff brand's own pages vs the cited-source feature profile → concrete missing features per prompt. | 02 | citation-gap, content-gap | **Done** |

## Stage B — Prescribe (the fix engine — keystone bridge)

| Epic ID | Epic | Delivers | Depends | Reuses | Status |
|---|---|---|---|---|---|
| **GIL-04** | Fix-type taxonomy & registry | Documented, versioned catalog of answer-optimized asset types (FAQ, comparison, schema, entity, pricing, glossary, proof). | — | scoring-constants registry pattern | **Done** |
| **GIL-05** | Citation-Fix recommender | Each root-cause gap → specific fix type + concrete target + directional expected-lift band. Ranked, evidence-ID'd, honesty-labelled. | 03, 04 | unified growth decisions, evidence gating | **Done** |
| **GIL-06** | Fix surface (API + dashboard) | `GET /api/geo-fixes` + `/demo/geo-fixes`: why-not-cited + fix + evidence + labels + empty state. | 05 | GIP dashboard, provenance UI | **Done** |

## Stage C — Draft + Gate

| Epic ID | Epic | Delivers | Depends | Reuses | Status |
|---|---|---|---|---|---|
| **GIL-07** | Fix → crew-brief adapter | Prescribed fix → structured brief the crew drafts against. | 05 | agent crew wiring | **Done** |
| **GIL-08** | Answer-optimized draft + claim-check | Crew drafts the asset; claim-checker rejects unsupported claims; gated draft with sources. | 07 | crew QA, claim checks | **Done** |
| **GIL-09** | Approval + provenance | Human approval gate UI; approved drafts carry provenance for attribution. | 08 | approval gates, provenance store | **Done** |

## Stage D — Prove (causal citation lift)

| Epic ID | Epic | Delivers | Depends | Reuses | Status |
|---|---|---|---|---|---|
| **GIL-10** | Change ledger (intervention record) | Record what changed, when, on which prompts/assets. | 09 | durable audit/evidence store | **Done** |
| **GIL-11** | Re-probe + lift attribution | Re-run universe post-change; compute citation lift with statistical layer; label causal vs directional. | 10 | metric-integrity + statistical layer | **Done** |
| **GIL-12** | Lift reporting surface | Before/after per prompt, confidence intervals, honest labels. | 11 | metric UI, outcome-learning | **Done** |

## Stage E — Learn

| Epic ID | Epic | Delivers | Depends | Reuses | Status |
|---|---|---|---|---|---|
| **GIL-13** | Fix-outcome store | Record (fix type, prompt type) → observed lift. | 12 | outcome-learning slice | **Done** |
| **GIL-14** | Outcome reweighting (bandit) | Feed outcomes into MAB/learning layer to reweight which fix types win. | 13 | agentic-MAB layer | **Done** |
| **GIL-15** | Learned-prior recommender upgrade | GIL-05 reads learned weights → recommendations improve over time. | 14 | recommender (05) | **Done** |

**Optional parallel track (not critical path):** multi-engine expansion — sample
ChatGPT/Perplexity/etc. beyond Gemini so the ledger widens. Slot after GIL-06.

## Non-negotiables (inherited, carried through all 15)

No fake lift numbers · expected-lift is always a directional band · causal vs directional
always labelled · human gate on every draft, never auto-publish · no unsupported claims in
drafts · weak evidence → say "insufficient/directional", never hidden.
