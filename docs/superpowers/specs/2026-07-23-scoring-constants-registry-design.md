# Scoring Constants Registry — Design

**Date:** 2026-07-23
**Status:** Approved (user: "if you think it's worth, do it — real software, no dummy data")
**Product:** OpenGrowth AI Engine
**Slice:** Sub-project 4 of the metric-integrity effort — give every scoring constant a single documented home; delete dead saturating code.

## Why

An audit of the scoring engines found three real defects. Two claims from the
original audit did **not** survive verification and are recorded here for
honesty:

- *"Priority score saturates"* — the saturating multiplicative function
  `calculatePriorityScore` is called by **no** live code. The production path
  (`calculateRecommendationPriority`, used by `recommendation-bus` and
  `growth-intelligence`) is already a bounded weighted model. The saturating
  function is dead.
- *"Readiness is not portfolio-comparable"* — the site score is the **mean of
  per-page scores** (`aggregateSite`), already normalised by page count. A
  50-page and a 5-page site are comparable. This claim was wrong.

The genuine defects:

1. **Dead saturating code.** `calculatePriorityScore` (and its test) exist only
   to be tested. It multiplies four 0–10 inputs and clamps at 100, so any input
   set with effort ≤ 10 saturates — a real hazard if ever wired in. Delete it.

2. **Two conflicting severity scales in one system.** Readiness scoring uses
   `PENALTY = {critical:15, high:6, quick-win:3, monitor:1, ignore:0}`. Issue
   ranking uses `SEVERITY_WEIGHT = {critical:4, high:3, quick-win:2, monitor:1,
   ignore:0}`. Same severity concept, two undocumented numeric scales that could
   drift apart.

3. **No provenance on any scoring constant.** The two penalty scales and the
   readiness band cutoffs (85/70/50) are magic numbers with no recorded
   justification. For a product whose promise is "every number has a solid
   reason," this is the gap.

This slice creates one documented registry, rewires the scoring engines to read
from it, and deletes the dead function. **No constant value changes** — the work
is provenance and single-sourcing, so behaviour is preserved exactly.

## Scope decision

Constant *values* are kept identical. Re-tuning penalties or cutoffs is
subjective and risky; making them defensible, consistent, and tunable is the
win. Tactic-priority and effort-hour constants in `deep-engine.ts` (~15 inline
numbers) are a separate later slice — this registry covers the **readiness
scoring core** (severity model + bands), the numbers most on display.

## The registry

`lib/engines/scoring-constants.ts`, the single source of truth:

```ts
import type { Severity } from "@/lib/domain/types";
import type { ReadinessBand } from "@/lib/engines/readiness";

export interface SeverityModel {
  /** Points subtracted from a 100-point readiness score, per issue of this severity. */
  scorePenalty: number;
  /** Ordinal importance for ranking which issues are "top" (higher = more important). */
  rank: number;
  /** Why these values — the defensible reason. */
  rationale: string;
}

export const SEVERITY: Record<Severity, SeverityModel> = {
  critical:   { scorePenalty: 15, rank: 4, rationale: "Blocks indexing or discovery; a single one materially suppresses visibility." },
  high:       { scorePenalty: 6,  rank: 3, rationale: "Meaningfully weakens a page's ranking or conversion; several compound." },
  "quick-win":{ scorePenalty: 3,  rank: 2, rationale: "Low-effort improvement with modest isolated impact." },
  monitor:    { scorePenalty: 1,  rank: 1, rationale: "Minor; watch but rarely worth dedicated work." },
  ignore:     { scorePenalty: 0,  rank: 0, rationale: "No action warranted." },
};

export interface ReadinessBandDef {
  min: number;
  band: ReadinessBand;
  rationale: string;
}

/** Ordered high→low; the first whose `min` is met wins. */
export const READINESS_BANDS: ReadinessBandDef[] = [
  { min: 85, band: "excellent", rationale: "At most a few quick-wins remain; the site is discovery-ready." },
  { min: 70, band: "good",      rationale: "Fundamentally sound with a handful of high-value fixes outstanding." },
  { min: 50, band: "fair",      rationale: "Real gaps present; a focused pass yields visible gains." },
  { min: 0,  band: "poor",      rationale: "Critical blockers dominate; foundational work needed first." },
];
```

The penalty and rank values are the existing ones verbatim, so nothing scored
today changes; they now carry a reason and live in one place.

## Rewiring

- `lib/engines/readiness.ts`: delete the local `PENALTY` map and `bandFor`'s
  hardcoded cutoffs. `computeReadiness` reads `SEVERITY[s].scorePenalty`;
  `bandFor` scans `READINESS_BANDS`. Its public signatures and outputs are
  unchanged.
- `lib/engines/site-audit.ts`: delete the local `SEVERITY_WEIGHT` map. The
  `topIssues` sort reads `SEVERITY[s].rank`.
- `lib/engines/priority.ts`: delete `calculatePriorityScore` and `PriorityInputs`.
- `tests/unit/priority.test.ts`: remove the `calculatePriorityScore` describe
  block (the other priority tests stay).

## Error handling

- `bandFor` iterates `READINESS_BANDS` high→low and returns the first match; the
  final `{ min: 0 }` entry guarantees a result for any score in [0, 100]. A
  registry with no `min: 0` entry is a construction error caught by a test, not
  a runtime fallback.
- `SEVERITY` is keyed by the exhaustive `Severity` union, so a missing severity
  is a compile error, not a silent `?? 1`.

## Testing

- Registry consistency: `scorePenalty` and `rank` are both strictly decreasing
  from `critical` → `ignore`; every `Severity` key is present; `READINESS_BANDS`
  is sorted strictly descending by `min` and ends at `min: 0`.
- Behaviour preservation: `computeReadiness` on a fixed issue set returns the
  same score/band as the pre-refactor values (critical −15, high −6, etc.);
  `bandFor(85)` = "excellent", `bandFor(84)` = "good", `bandFor(50)` = "fair",
  `bandFor(49)` = "poor".
- `aggregateSite` `topIssues` ordering is unchanged for a set mixing severities
  and counts (rank × count ranking preserved).
- Dead-code removal: `calculatePriorityScore` no longer exists (grep gate in the
  task) and the suite still passes.

## Honesty constraints

Every scoring constant now carries a written rationale and a single source of
truth. No value is changed silently — this is a provenance refactor, and the
tests prove behaviour is preserved.
