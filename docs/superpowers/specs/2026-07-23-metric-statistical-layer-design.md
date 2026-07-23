# Metric Statistical Layer — Design

**Date:** 2026-07-23
**Status:** Approved (user: "start building"; direction pre-approved in the metric-integrity spec)
**Product:** OpenGrowth AI Engine
**Slice:** Sub-project 2 of 4 — real intervals, computed confidence, sample gating, significance testing

## Why

Sub-project 1 gave every displayed number a typed `Metric` and reserved
`interval`, `confidence`, and `sample` fields, but confidence is still a
placeholder (`n >= minReliable ? "low" : "insufficient"`) and `wilsonInterval`
is a stub returning `null`. Two live defects remain from the audit:

1. **Confidence is asserted, not computed.** `geo-metrics.ts` sets
   `confidence = "Medium"` when `sampleSize >= 8`. With n=8 and p̂=0.375 the 95%
   Wilson interval is ~[14%, 69%] — a 55-point spread that is not "Medium"
   confidence by any statistical standard.

2. **Run-to-run deltas ignore significance.** `analyze-delta.ts` calls a rate
   change `improved` from raw direction alone. A GEO mention rate moving 40% →
   42% between two n=5 runs is reported as improvement when it is
   indistinguishable from noise. For an enterprise buyer this is the difference
   between a measurement product and a random-number generator.

This layer computes real 95% Wilson intervals, derives confidence from interval
width, enforces per-metric minimum samples, and gates deltas behind a
two-proportion significance test.

## Statistical definitions

### Wilson score interval (95%)

For `k` successes in `n` trials, `p̂ = k/n`, `z = 1.96`:

```
center = (p̂ + z²/2n) / (1 + z²/n)
margin = (z / (1 + z²/n)) · √( p̂(1-p̂)/n + z²/4n² )
low = center − margin,  high = center + margin
```

Returned on the **0–100 scale** (multiply by 100) to match `Metric<"percent">`,
clamped to [0, 100]. `n = 0` returns `null` (no interval). Wilson is chosen over
the naive normal interval because it behaves correctly at small `n` and extreme
`p̂` (0 or 1), which is exactly the regime GEO sampling lives in.

### Confidence from interval width

```
metricConfidence(interval, sample):
  if !interval or sample.n < sample.minReliable → "insufficient"
  width = interval.high − interval.low          (percentage points)
  if width ≤ 15 → "high"
  if width ≤ 30 → "medium"
  else          → "low"
```

Confidence is a property of *precision*, not merely count. A large sample with a
still-wide interval (high variance) is honestly "low", and a metric below its
minimum sample is "insufficient" regardless of its point value.

### Per-metric minimum sample

A small registry, the single source of truth:

```ts
export const MIN_RELIABLE = {
  geoMentionRate: 20,
  firstPartyCitationShare: 15,
} as const;
```

### Two-proportion significance test

For counts `(k1, n1)` and `(k2, n2)`:

```
p1 = k1/n1, p2 = k2/n2
pooled = (k1 + k2) / (n1 + n2)
se = √( pooled·(1−pooled)·(1/n1 + 1/n2) )
z = (p2 − p1) / se        (se = 0 → not significant)
```

Two-sided p-value from the standard normal CDF (Abramowitz–Stegun 7.1.26
approximation, adequate for display). `isSignificantChange` is `p < 0.05`.

## Wiring

Nothing in the core engine result types changes — all attachment happens at the
display/metric boundary, as in sub-project 1.

**GEO rate metric** — a `geoMentionMetric(geo)` accessor in
`lib/marketing/metrics-view.ts` builds `Metric<"percent">` with:
- value from `geo.brandMentionRate` (0–100, unchanged),
- `sample: { n: geo.sampleSize, minReliable: MIN_RELIABLE.geoMentionRate }`,
- `interval` from `wilsonInterval(successes, n)` where
  `successes = round(brandMentionRate/100 · sampleSize)`,
- `confidence` from `metricConfidence(interval, sample)`.

The Position-Report headline stat (`report-html.ts:88`, already routed through
`percentValue` in sub-project 1) switches to `geoMentionMetric` so the printed
report carries the interval and gates below n=20.

**geo-metrics confidence** — `computeGeoVariability`'s `confidence` field keeps
its `"High" | "Medium" | "Low"` output type (consumers unchanged) but is now
derived from the Wilson interval width via a mapping
(`insufficient|low → "Low"`, `medium → "Medium"`, `high → "High"`), replacing
the `sampleSize >= 8` / `>= 12` thresholds. Its labels gain the interval, e.g.
`"40% (95% CI 14–69%, n=8)"`.

**analyze-delta significance** — `compareAnalyzeSnapshots` gains, for the two
rate metrics (`brandMentionRate`, `firstPartyCitationShare`), a significance
gate: reconstruct counts from `rate` and `sampleSize` on both snapshots, run
`isSignificantChange`, and set `improved` only when the change is significant
**and** directionally beneficial. `DeltaMetric` gains a `significant: boolean`
field. Non-rate metrics (counts, scores) keep their existing direction logic and
report `significant: true` (they are exact counts, not samples).

## Boundaries

- `lib/metrics/wilson.ts` — real `wilsonInterval`; add `metricConfidence`,
  `MIN_RELIABLE`.
- `lib/metrics/significance.ts` — `twoProportionPValue`, `isSignificantChange`,
  `normalCdf`.
- `lib/marketing/metrics-view.ts` — add `geoMentionMetric`.
- `lib/engines/geo-metrics.ts` — confidence derivation swapped, output type kept.
- `lib/engines/analyze-delta.ts` — significance gate on the two rate metrics;
  `DeltaMetric.significant` added.

## Error handling

- `n = 0` or non-finite inputs → `wilsonInterval` returns `null`; the metric is
  `insufficient` and renders via the gate message, never as a number.
- `se = 0` (both proportions 0 or both 1) → `isSignificantChange` is `false`
  (no evidence of change), never a division error.
- Reconstructed counts are `round(rate/100 · n)` and clamped to `[0, n]`.

## Testing

- Wilson: known values (verified numerically) — `wilsonInterval(2, 5)` ≈
  [11.8, 76.9]% (±0.5); `wilsonInterval(5, 25)` ≈ [8.9, 39.1]%;
  `wilsonInterval(0, 10)` low = 0; `wilsonInterval(10, 10)` high = 100;
  `wilsonInterval(0, 0)` = null.
- Confidence: width ≤15 → high, ≤30 → medium, else low; below `minReliable` →
  insufficient regardless of width.
- Significance: identical rates → not significant; 2/50 vs 20/50 → significant
  (p < 0.05); tiny samples 2/5 vs 3/5 → not significant.
- `normalCdf(0)` = 0.5; `normalCdf(1.96)` ≈ 0.975 (±0.001).
- geoMentionMetric: n=25 attaches an interval and a non-insufficient confidence;
  n=3 is `insufficient` and its metric renders the gate message.
- analyze-delta: a 40%→42% change on n=5 both sides has `improved === false` and
  `significant === false`; a 10%→60% change on n=30 has `improved === true`.

## Honesty constraints

A rate below its minimum sample never displays as a reliable number. "Improved"
means *significantly* improved, never noise. Every rate metric carries its 95%
interval so the uncertainty travels with the point estimate.
