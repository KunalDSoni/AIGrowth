# Metric Integrity Core — Design

**Date:** 2026-07-23
**Status:** Approved (user: "GO")
**Product:** OpenGrowth AI Engine
**Slice:** Sub-project 1 of 4 — the typed metric foundation plus the two P0 fixes

## Why

An audit of every number-producing engine found defects that make the current
output indefensible for an enterprise buyer. Two are P0:

1. **A 100× unit error in the headline GEO metric.** `run-geo.ts` and
   `geo-metrics.ts` already return `brandMentionRate` as a percentage (0–100),
   but ten display sites multiply by 100 again. A real 40% mention rate renders
   as "4000%". It is masked today only because the design-partner's actual rate
   is 0, and 0 × 100 = 0. The first client with any answer-engine presence sees
   nonsense. One of the ten sites (`lib/agents/impl/observer.ts:73`) was
   introduced in the agent-runtime work and must be fixed with the rest.

2. **A fabricated quantitative forecast.** `os.ts:512` and `workspace.ts:232`
   emit `expectedLeadLiftBand: "+8–18% directional"` selected by a string
   ternary on an internal priority score. No traffic data, no conversion rate,
   no baseline, no model. It is a business forecast with zero derivation, and
   the product's own `claim-validation.ts` would flag it in a client's copy.

The durable cause of the 100× class of bug is that a percentage is represented
as a bare `number`, so multiplying it by 100 is legal. This sub-project makes
units and provenance part of the type, so the error cannot compile, and fixes
both P0 defects as its first concrete acts.

The full statistical layer (Wilson intervals, sample gating, significance
tests), scoring-model corrections (readiness normalisation, priority
saturation), and the constant-provenance registry are sub-projects 2–4. They
depend on the `Metric` type defined here.

## The metric contract

Every number the system **displays** is a `Metric`, not a `number`. Internal
arithmetic stays plain `number`; the boundary is the engine's public edge and
the UI.

```ts
export type Unit = "percent" | "count" | "score" | "usd" | "hours" | "ratio" | "days";

export type MetricBasis =
  | "measured"   // counted from real observations (crawl, GEO run, GSC)
  | "derived"    // a formula over measured inputs (readiness score)
  | "estimated"  // a labelled projection with stated assumptions AND evidence
  | "config";    // a governance constant (sub-project 4)

export interface MetricSample {
  n: number;
  minReliable: number;
}

export interface MetricInterval {
  low: number;
  high: number;
  method: "wilson";
}

export interface Metric<U extends Unit = Unit> {
  value: number;
  unit: U;
  basis: MetricBasis;
  /** Evidence records that justify it. Empty is a red flag, not a default. */
  evidenceIds: string[];
  sample?: MetricSample;
  interval?: MetricInterval;
  confidence?: "high" | "medium" | "low" | "insufficient";
}
```

`percent` stores a **0–100** value. The only way to build one from a fraction is
`percentFromFraction(0..1)`, which multiplies by 100 exactly once. There is no
other `× 100` anywhere: `formatMetric` owns rendering. Passing a fraction where
a percent is expected, or vice-versa, is a compile error because the
constructors are the sole entry points.

### Constructors (the only way to make a Metric)

```ts
percentFromFraction(fraction: number, opts): Metric<"percent">   // 0..1 → 0..100
percentValue(value0to100: number, opts): Metric<"percent">       // already 0..100
count(value: number, opts): Metric<"count">
score(value0to100: number, opts): Metric<"score">
usd(value: number, opts): Metric<"usd">
hours(value: number, opts): Metric<"hours">
```

`opts` carries `basis`, `evidenceIds`, and optional `sample`. `estimated` basis
**requires** a non-empty `assumptions` array on the opts, enforced at runtime;
this is what makes the fabricated lead-lift band impossible to reconstruct.

### Rendering

```ts
formatMetric(m: Metric): string
```

- `percent` → `"40%"` (never multiplies again — the value is already 0–100)
- `usd` → `"$0.12"`, `hours` → `"3h"`, `score` → `"72"`, `count` → `"19"`
- If `confidence === "insufficient"` on a **primary** surface, callers render
  the gate message instead of the value (see Display rule). `formatMetric`
  itself always returns the raw formatted value for inspection surfaces.

## Display rule (the enterprise invariant)

Settled during design: **suppress the point estimate on primary surfaces, expose
the range on inspection.** The measurement-vendor standard.

- **Primary surfaces** (KPI tiles, trend lines, Position/weekly reports): a
  metric whose `confidence` is `"insufficient"` shows
  `"Insufficient sample — n=3, need 20"` in place of the figure.
- **Inspection surfaces** (evidence drawer, metric detail, API payload): always
  expose value, interval, `n`, and confidence.
- **Invariant:** a number is never silently shown as if reliable.

Sub-project 1 defines the `confidence` field and the gate helper
`isReliable(m): boolean`. It does **not** yet compute Wilson intervals or real
confidence — those arrive in sub-project 2. Until then, `confidence` is set by a
simple `n >= minReliable` gate so the display rule is already enforceable and
testable end to end.

## P0 fix 1 — the 100× error

**Correction to the original diagnosis (found during planning).** The spec first
proposed converting `run-geo` to a 0–1 fraction. That is backwards. The producer
`run-geo.ts:81` already emits `brandMentionRate` as **0–100** (`Math.round(x *
100)`), and ~8 consumers correctly depend on that: `next-actions.ts`,
`action-brief.ts`, `live-citation-gaps.ts`, `analyze-delta.ts`. Converting to a
fraction would break all of them and force a migration of persisted `.data`
JSON. **0–100 is the contract; it stays.**

The real defect is a **two-convention split**: a second family of code was
written assuming the field is a 0–1 fraction and multiplies by 100 at display
time, producing "4000%". The fix keeps 0–100 and wraps values with
`percentValue` (the already-0–100 constructor), deleting the erroneous `× 100`.
`percentFromFraction` is **not** used for the GEO rate.

**The eleven live display sites** (all in the running path; all display-only, no
logic bugs):

```
lib/marketing/deep-engine.ts  lines 98, 99, 214, 517, 629, 652, 696
lib/marketing/workspace.ts    lines 161, 302
lib/marketing/report-html.ts  line 88   (missed by the first list)
lib/agents/impl/observer.ts   line 73
```

**Dead code, deleted not fixed.** `lib/marketing/os.ts` (imported only by
`tests/unit/marketing-os.test.ts`, reachable from no route) carries the same
double-multiply *plus* genuine logic bugs (`geoRate < 0.4` / `< 0.5` compared
against a 0–100 value, so the branch never fires). Rather than repair code
nothing runs, `os.ts` and its test are removed. `buildMarketingOS`,
`recommendTactics`, and `buildCampaignPack` are the superseded Phase 1–5
implementation; the live product uses `deep-engine.ts` + `workspace.ts`. Before
deletion, confirm no non-test import exists (a grep gate in the task).

Regression test: a GEO run with 2 of 5 brand mentions renders `"40%"`, and the
string `"4000%"` (or any value > 100%) appears nowhere in the rendered Position
Report or weekly pack.

## P0 fix 2 — the fabricated forecast

`SimulationResult.expectedLeadLiftBand` is removed from the type
(`lib/marketing/types.ts:157`). Both producers (`os.ts:510`, `workspace.ts:231`)
stop emitting it. The struct keeps only defensible fields:

```ts
export interface SimulationResult {
  tacticId: string;
  costHours: Metric<"hours">;      // real: from pack effortHours
  liftEstimable: false;            // honest: no conversion baseline
  reason: string;                  // "Lift not estimable without a conversion
                                   //  baseline. Connect GA4 to model it."
  evidenceIds: string[];
}
```

No quantitative business outcome is asserted anywhere without a derivation. When
GA4 lands (a later sub-project), a real lift model with `basis: "estimated"` and
explicit assumptions can replace `liftEstimable: false`.

## Three unit/labelling corrections folded in

These are metric-boundary errors of the same family, cheap to fix here:

- **`quickWins` double-count** (`readiness.ts:41`): `quickWins = count("quick-win")
  + monitor` conflates two severities. Split into distinct `quickWins` and
  `monitors` counts; the summed field is removed.
- **Channel-mix unit confusion** (`os.ts` `buildChannelMix`): sums *priority
  scores* and treats the ratio as a share of *hours*. Priority is ordinal, not a
  resource quantity. Re-derive the split from each tactic's `effortHours`
  (a real quantity), not its priority.
- **Cost honesty** (`run-geo.ts:88`): `estimatedUsd` is a "rough heuristic for
  display only" that ships in `GeoResult.cost`. Expose it as `Metric<"usd">`
  with `basis: "estimated"` and an assumption string naming the blended rate, so
  the UI can mark it estimated rather than presenting it as billed cost.

## Boundaries

New module `lib/metrics/`:

- `types.ts` — the `Metric` union and unit types
- `construct.ts` — the constructors with runtime guards
- `format.ts` — `formatMetric`, `isReliable`, gate-message helper
- `wilson.ts` — interval helper **stub** (real body in sub-project 2), so the
  field and call sites exist now

Engines return `Metric` at their public edge; the UI reads only `Metric` and
never does arithmetic. One engine converts per task.

## Error handling

- A constructor called with `basis: "estimated"` and no assumptions throws at
  construction — a programming error, surfaced in tests, never shipped.
- `formatMetric` on a metric with `NaN`/`Infinity` value renders `"—"` and the
  metric is treated as `insufficient`, never as a number.
- A `percent` value outside 0–100 after construction is a bug by definition;
  `construct` clamps to [0,100] and records nothing silently — the clamp is
  covered by a test asserting it can only trigger on malformed input.

## Testing

- Unit: `percentFromFraction(0.4)` → value 40; `formatMetric` → `"40%"`.
- Unit: constructing an `estimated` metric without assumptions throws.
- Unit: `isReliable` false when `n < minReliable`, and `formatMetric` gate path
  yields `"Insufficient sample — n=3, need 20"`.
- Regression: GEO run 2/5 → `"40%"`; `"4000%"` absent from rendered reports.
- Regression: `SimulationResult` no longer carries any lift band; the string
  `"directional"` as a lift forecast appears nowhere.
- Unit: `quickWins` and `monitors` are separate; neither includes the other.
- Unit: channel-mix hours sum to `hoursPerWeek` (±rounding) and derive from
  effort, verified by a case where priority order and effort order differ.

## Honesty constraints

Carried forward. Estimates stay labelled estimates — now enforced by
`basis: "estimated"` requiring assumptions. No number displays as reliable below
its minimum sample. Cost figures are actuals or explicitly estimated, never
ambiguous.
