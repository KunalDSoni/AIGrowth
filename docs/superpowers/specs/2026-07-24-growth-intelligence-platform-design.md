# Growth Intelligence Platform — packaging design

**Date:** 2026-07-24
**Status:** Approved for build (Approach A)
**Scope:** One vertical slice — unified endpoint + dashboard over existing engines.

## Problem

OpenGrowth already computes six "intelligences" (Search, Technical, Business, Content, AI Visibility, Marketing) as discrete engines under `lib/engines/`, and it already has a capstone aggregator — `growth-intelligence.ts` (`buildGrowthSignals` → `buildUnifiedGrowthDecisions`). But that aggregator is an **orphan**: nothing imports it. The six intelligences reach users through ~8 disconnected API routes and demo pages. There is no single "Growth Intelligence" surface that fuses them into one ranked story.

An earlier slice (`SLICE-UNIFIED-GROWTH-INTELLIGENCE.md`) wired the aggregator to a demo dashboard using deterministic demo signals. The later "no Northstar/demo data" refactor (introducing `live-intelligence.ts`) removed that path, leaving the aggregator disconnected from live evidence.

## Goal

Package what exists into one coherent product surface, driven by **live** crawl + GEO evidence:

1. A composition module that maps live evidence into the aggregator's typed inputs and produces one `GrowthIntelligenceReport`.
2. A single endpoint `GET /api/growth-intelligence?domain=` returning that report.
3. A single dashboard `/demo/growth-intelligence` presenting the six pillars + ranked unified decisions with evidence, honesty labels and guardrails.

Non-goals: no new AI framework, no crawler swap, no change to the pure aggregator's ranking logic, no new external data source.

## Approach A (chosen)

Three clean units, mirroring the existing `live-intelligence (compose) → engines (pure) → route/UI (surface)` layering:

- **Compose** (`lib/engines/growth-intelligence-compose.ts`) — new adapter. Input: `AnalyzeResult`. Maps `buildLiveIntelligence(result)` output + audit issues + recommendations + outcomes from the result into the six typed arrays the aggregator consumes, then calls the existing pure `buildGrowthSignals` / `buildUnifiedGrowthDecisions`, and assembles a `GrowthIntelligenceReport`.
- **Aggregate** (`lib/engines/growth-intelligence.ts`) — unchanged. Pure ranking.
- **Surface** — thin route + dashboard page, both consuming `GrowthIntelligenceReport`.

Rejected: B (extend the already-large `live-intelligence.ts` — grows a 470-line unit, couples orchestration to ranking types) and C (inline adapter in the route — untestable, non-reusable).

## Data flow

```
prior scan  ──►  ProjectStore.loadLatest(domainKey)  ──►  AnalyzeResult
                                                              │
                          buildLiveIntelligence(result) ──────┤
                                                              ▼
        growth-intelligence-compose.ts
          ├─ map → { recommendations, auditIssues, opportunities,
          │           aiVisibility, citationGaps, outcomes }   (six typed inputs)
          ├─ buildGrowthSignals(inputs)            → GrowthSignal[]
          ├─ buildUnifiedGrowthDecisions(signals)  → UnifiedGrowthDecision[]
          ├─ buildPillarSnapshot(inputs, live)     → PillarSummary[] (6 pillars)
          └─ assemble                              → GrowthIntelligenceReport
                                                              │
   GET /api/growth-intelligence?domain=  ◄────────────────────┤
   /demo/growth-intelligence page        ◄────────────────────┘
```

If no prior scan exists for the domain, the route returns `409 { needsScan: true }` (same contract as `/api/opportunities`). No stand-in data is ever synthesized.

## Contracts

### `GrowthIntelligenceReport` (new, in `lib/domain/types.ts`)

```ts
type GrowthPillarId =
  | "search" | "technical" | "business" | "content" | "ai-visibility" | "marketing";

interface PillarSummary {
  id: GrowthPillarId;
  label: string;
  signalCount: number;          // signals attributed to this pillar
  topSignalTitle: string | null;
  evidenceIds: string[];
  labels: string[];             // honesty/limitation labels for this pillar
}

interface GrowthIntelligenceReport {
  domain: string;
  generatedAt: string;
  pillars: PillarSummary[];              // always 6, in fixed order
  decisions: UnifiedGrowthDecision[];    // top-ranked cross-engine decisions
  guardrails: string[];                  // seoGuardrails from the aggregator
  labels: string[];                      // global honesty labels (from LiveIntelligence + geoMetrics)
  evidenceIds: string[];                 // union of decision evidence
}
```

### Compose module (new)

```ts
// lib/engines/growth-intelligence-compose.ts
export function buildGrowthIntelligenceReport(
  result: AnalyzeResult,
  options?: { history?: AnalyzeSnapshot[] },
): GrowthIntelligenceReport;
```

## Pillars vs signal sources (explicit reconciliation)

The aggregator's `GrowthSignal.source` enum is `technical | content | ai-visibility | citation | outcome` (five). The product's six pillars are a **presentation grouping** over engines, not the signal taxonomy. Mapping used for `buildPillarSnapshot`:

| Pillar | Fed by |
|---|---|
| Search | search opportunities → content signals; next actions |
| Technical | audit issues → technical signals; AI access findings |
| Business | business graph / priority context (context only; contributes evidence + labels, not its own signal source) |
| Content | content inventory / opportunities → content signals |
| AI Visibility | AI visibility summaries → ai-visibility signals; geo metrics |
| Marketing | campaign / recommendations → content signals; outcomes → outcome signals |

`signalCount` per pillar is derived by attributing each `GrowthSignal` to a pillar via a documented source→pillar map (`citation` and `ai-visibility` → AI Visibility; `outcome` → Marketing; `technical` → Technical; `content` split by originating engine tag where available, else Content). Decisions themselves remain source-ranked and pillar-agnostic; pillars are for the narrative header only.

## Error handling

- Missing `domain` query param → `400`.
- No prior scan → `409 { needsScan: true, report: null }`.
- `buildLiveIntelligence` / compose throws → `500` with message; never a partial or fabricated report.
- Empty evidence (scan produced no pages/observations) → valid report with empty decisions, pillars all zero, and a label explaining insufficiency. "Insufficient" is stated, never hidden.

## Honesty rules (carried through, non-negotiable)

- `seoGuardrails` attached to every report.
- `LiveIntelligence.labels` + `geoMetrics.labels` surfaced verbatim.
- No guaranteed rankings/citations/traffic; GEO directional only; search demand crawl-derived until GSC.
- `rejectUnsafeGrowthAction` remains the copy gate for any downstream drafting (out of scope here but not weakened).

## Testing

- **Unit** (`vitest`): compose adapter maps each of the six inputs correctly from a fixture `AnalyzeResult`; pillar snapshot attribution; empty-evidence path; report assembly carries labels + guardrails + evidence union.
- **Route**: 400 (no domain), 409 (no scan), 200 (report shape) against a seeded store.
- **E2E** (`playwright`): `/demo/growth-intelligence` renders six pillar cards + at least one decision card with evidence + guardrails visible; shows the "run a scan first" empty state for an un-scanned domain.

## Success criteria

A user who has scanned a domain can open `/demo/growth-intelligence` and see one page that fuses all six intelligences into ranked, evidence-backed decisions with honest limitation labels — no demo data, no orphaned aggregator, no eight-tab hunt.
