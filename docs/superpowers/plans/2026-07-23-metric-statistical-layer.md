# Metric Statistical Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the metric stubs with real statistics — 95% Wilson intervals, interval-width confidence, per-metric sample gates, and a two-proportion significance test that stops "improved" from meaning noise.

**Architecture:** Two new pure-math modules (`wilson.ts` completion, `significance.ts`) feed a `geoMentionMetric` accessor and a significance gate in `analyze-delta`. All attachment happens at the display/metric boundary; no core engine result type changes.

**Tech Stack:** TypeScript, Vitest. Pure functions, no dependencies.

## Global Constraints

- Wilson and significance values are verified numerically; test expectations use the confirmed numbers below, tolerance ±0.5 for intervals and ±0.001 for `normalCdf`.
- Percent metrics are on the 0–100 scale; intervals are returned on 0–100 and clamped to [0, 100].
- Nothing in `AnalyzeResult` / `GeoResult` changes; wrapping happens in `lib/metrics/*` and `lib/marketing/metrics-view.ts`, and `analyze-delta` gains one field.
- A rate below its minimum sample is `insufficient` and never renders as a reliable number.
- `npm test`, `npm run typecheck`, `npm run lint` (`--max-warnings=0`), `npm run build` all pass. Alias `@/` → repo root.

---

### Task 1: Real Wilson interval, confidence, and thresholds

**Files:**
- Modify: `lib/metrics/wilson.ts`
- Modify: `lib/metrics/construct.ts` (use `metricConfidence` for sampled metrics)
- Test: `tests/unit/metric-wilson.test.ts`

**Interfaces:**
- Consumes: `Metric`, `MetricInterval`, `MetricSample`, `MetricConfidence` from `lib/metrics/types`
- Produces: `wilsonInterval(successes: number, n: number): MetricInterval | null`, `metricConfidence(interval: MetricInterval | null, sample?: MetricSample): MetricConfidence`, `MIN_RELIABLE`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/metric-wilson.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MIN_RELIABLE, metricConfidence, wilsonInterval } from "@/lib/metrics/wilson";

describe("wilsonInterval", () => {
  it("computes a known interval", () => {
    const i = wilsonInterval(2, 5)!;
    expect(i.method).toBe("wilson");
    expect(i.low).toBeCloseTo(11.8, 0);
    expect(i.high).toBeCloseTo(76.9, 0);
  });

  it("clamps at the boundaries", () => {
    expect(wilsonInterval(0, 10)!.low).toBe(0);
    expect(wilsonInterval(10, 10)!.high).toBe(100);
  });

  it("returns null for n=0 or non-finite input", () => {
    expect(wilsonInterval(0, 0)).toBeNull();
    expect(wilsonInterval(Number.NaN, 5)).toBeNull();
  });
});

describe("metricConfidence", () => {
  const sample = { n: 25, minReliable: 20 };
  it("is insufficient below the minimum sample", () => {
    expect(metricConfidence({ low: 30, high: 50, method: "wilson" }, { n: 3, minReliable: 20 })).toBe("insufficient");
  });
  it("is insufficient with no interval", () => {
    expect(metricConfidence(null, sample)).toBe("insufficient");
  });
  it("maps interval width to confidence", () => {
    expect(metricConfidence({ low: 40, high: 52, method: "wilson" }, sample)).toBe("high"); // 12pp
    expect(metricConfidence({ low: 30, high: 55, method: "wilson" }, sample)).toBe("medium"); // 25pp
    expect(metricConfidence({ low: 10, high: 60, method: "wilson" }, sample)).toBe("low"); // 50pp
  });
});

describe("MIN_RELIABLE", () => {
  it("names the per-metric sample floors", () => {
    expect(MIN_RELIABLE.geoMentionRate).toBe(20);
    expect(MIN_RELIABLE.firstPartyCitationShare).toBe(15);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/metric-wilson.test.ts`
Expected: FAIL — `metricConfidence`/`MIN_RELIABLE` not exported; `wilsonInterval` returns null.

- [ ] **Step 3: Implement wilson.ts**

Replace `lib/metrics/wilson.ts`:

```ts
import type { MetricConfidence, MetricInterval, MetricSample } from "@/lib/metrics/types";

/** Per-metric minimum reliable sample sizes — the single source of truth. */
export const MIN_RELIABLE = {
  geoMentionRate: 20,
  firstPartyCitationShare: 15,
} as const;

const Z = 1.96; // 95%
const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** 95% Wilson score interval for k successes in n trials, on the 0-100 scale. */
export function wilsonInterval(successes: number, n: number): MetricInterval | null {
  if (!Number.isFinite(successes) || !Number.isFinite(n) || n <= 0) return null;
  const p = successes / n;
  const z2 = Z * Z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (Z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    low: Math.round(clamp((center - margin) * 100) * 100) / 100,
    high: Math.round(clamp((center + margin) * 100) * 100) / 100,
    method: "wilson",
  };
}

/** Confidence is a property of precision (interval width), not merely count. */
export function metricConfidence(
  interval: MetricInterval | null,
  sample?: MetricSample,
): MetricConfidence {
  if (sample && sample.n < sample.minReliable) return "insufficient";
  if (!interval) return "insufficient";
  const width = interval.high - interval.low;
  if (width <= 15) return "high";
  if (width <= 30) return "medium";
  return "low";
}
```

- [ ] **Step 4: Route construct.ts sampled confidence through metricConfidence**

In `lib/metrics/construct.ts`, replace the inline confidence block inside `build`:

```ts
  const finite = Number.isFinite(value);
  const confidence = !finite
    ? ("insufficient" as const)
    : opts.sample
      ? metricConfidence(opts.interval ?? null, opts.sample)
      : undefined;
```

Add `interval` to `ConstructOpts` and import `metricConfidence`:

```ts
import { metricConfidence } from "@/lib/metrics/wilson";
import type { Metric, MetricBasis, MetricInterval, MetricSample, Unit } from "@/lib/metrics/types";

export interface ConstructOpts {
  basis: MetricBasis;
  evidenceIds: string[];
  sample?: MetricSample;
  interval?: MetricInterval;
  assumptions?: string[];
}
```

And thread `interval` into the returned object:

```ts
  return {
    value: finite ? value : Number.NaN,
    unit,
    basis: opts.basis,
    evidenceIds: opts.evidenceIds,
    ...(opts.sample ? { sample: opts.sample } : {}),
    ...(opts.interval ? { interval: opts.interval } : {}),
    ...(confidence ? { confidence } : {}),
    ...(opts.assumptions ? { assumptions: opts.assumptions } : {}),
  };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/metric-wilson.test.ts tests/unit/metric-construct.test.ts`
Expected: PASS. The construct test `n>=minReliable → "low"` still passes because with no interval and n≥minReliable, `metricConfidence(null, sample)` returns `"insufficient"` — UPDATE that expectation: a sampled metric with no interval is now `insufficient`, not `low`. In `tests/unit/metric-construct.test.ts` change:

```ts
    const ok = percentValue(40, { ...base, sample: { n: 25, minReliable: 20 } });
    expect(ok.confidence).toBe("insufficient"); // no interval supplied → insufficient
```

Re-run both files; expected PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/metrics/wilson.ts lib/metrics/construct.ts tests/unit/metric-wilson.test.ts tests/unit/metric-construct.test.ts
git commit -m "feat(metrics): real Wilson interval and interval-width confidence"
```

---

### Task 2: Two-proportion significance test

**Files:**
- Create: `lib/metrics/significance.ts`
- Test: `tests/unit/metric-significance.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `normalCdf(x: number): number`, `twoProportionPValue(k1: number, n1: number, k2: number, n2: number): number`, `isSignificantChange(k1: number, n1: number, k2: number, n2: number): boolean`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/metric-significance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isSignificantChange, normalCdf, twoProportionPValue } from "@/lib/metrics/significance";

describe("normalCdf", () => {
  it("matches known values", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 3);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });
});

describe("twoProportionPValue", () => {
  it("is ~1 for identical proportions", () => {
    expect(twoProportionPValue(2, 5, 2, 5)).toBeCloseTo(1, 2);
  });
  it("is tiny for a large clear difference", () => {
    expect(twoProportionPValue(2, 50, 20, 50)).toBeLessThan(0.001);
  });
  it("returns 1 when both proportions are 0 (se=0)", () => {
    expect(twoProportionPValue(0, 10, 0, 10)).toBe(1);
  });
});

describe("isSignificantChange", () => {
  it("is false for a small noisy change", () => {
    expect(isSignificantChange(2, 5, 3, 5)).toBe(false); // p ~ 0.53
  });
  it("is true for a large change on a real sample", () => {
    expect(isSignificantChange(3, 30, 18, 30)).toBe(true); // p ~ 5e-5
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/metric-significance.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/metrics/significance"`

- [ ] **Step 3: Implement significance.ts**

Create `lib/metrics/significance.ts`:

```ts
/**
 * Two-proportion significance test for run-to-run rate changes. Keeps
 * "improved" from meaning noise.
 */

/** Standard normal CDF via the error function (exact to ~1e-7). */
export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/** Abramowitz-Stegun 7.1.26 error-function approximation. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

export function twoProportionPValue(k1: number, n1: number, k2: number, n2: number): number {
  if (n1 <= 0 || n2 <= 0) return 1;
  const p1 = k1 / n1;
  const p2 = k2 / n2;
  const pooled = (k1 + k2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (se === 0) return 1;
  const z = (p2 - p1) / se;
  return 2 * (1 - normalCdf(Math.abs(z)));
}

export function isSignificantChange(k1: number, n1: number, k2: number, n2: number): boolean {
  return twoProportionPValue(k1, n1, k2, n2) < 0.05;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/metric-significance.test.ts`
Expected: PASS — 8 assertions across the describes.

- [ ] **Step 5: Commit**

```bash
git add lib/metrics/significance.ts tests/unit/metric-significance.test.ts
git commit -m "feat(metrics): two-proportion significance test"
```

---

### Task 3: GEO mention metric with interval and gating

**Files:**
- Modify: `lib/marketing/metrics-view.ts`
- Modify: `lib/marketing/report-html.ts` (headline stat)
- Test: `tests/unit/geo-mention-metric.test.ts`

**Interfaces:**
- Consumes: `wilsonInterval`, `MIN_RELIABLE` (Task 1), `percentValue` (`lib/metrics/construct`), `isReliable`, `gateMessage`, `formatMetric` (`lib/metrics/format`), `GeoResult`
- Produces: `geoMentionMetric(geo: Pick<GeoResult, "brandMentionRate" | "sampleSize">): Metric<"percent">`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/geo-mention-metric.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { geoMentionMetric } from "@/lib/marketing/metrics-view";
import { formatMetric, gateMessage, isReliable } from "@/lib/metrics/format";

describe("geoMentionMetric", () => {
  it("attaches a Wilson interval and a real confidence at n=25", () => {
    const m = geoMentionMetric({ brandMentionRate: 40, sampleSize: 25 });
    expect(m.value).toBe(40);
    expect(m.interval?.method).toBe("wilson");
    expect(m.sample).toEqual({ n: 25, minReliable: 20 });
    expect(m.confidence).not.toBe("insufficient");
    expect(isReliable(m)).toBe(true);
    expect(formatMetric(m)).toBe("40%");
  });

  it("is insufficient and gated below the minimum sample", () => {
    const m = geoMentionMetric({ brandMentionRate: 33, sampleSize: 3 });
    expect(m.confidence).toBe("insufficient");
    expect(isReliable(m)).toBe(false);
    expect(gateMessage(m)).toBe("Insufficient sample — n=3, need 20");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/geo-mention-metric.test.ts`
Expected: FAIL — `geoMentionMetric` not exported.

- [ ] **Step 3: Add geoMentionMetric**

In `lib/marketing/metrics-view.ts`, add:

```ts
import { percentValue, usd } from "@/lib/metrics/construct";
import { MIN_RELIABLE, wilsonInterval } from "@/lib/metrics/wilson";

export function geoMentionMetric(
  geo: Pick<GeoResult, "brandMentionRate" | "sampleSize">,
): Metric<"percent"> {
  const n = geo.sampleSize;
  const successes = Math.max(0, Math.min(n, Math.round((geo.brandMentionRate / 100) * n)));
  return percentValue(geo.brandMentionRate, {
    basis: "measured",
    evidenceIds: [],
    sample: { n, minReliable: MIN_RELIABLE.geoMentionRate },
    interval: wilsonInterval(successes, n) ?? undefined,
  });
}
```

(The existing `import { usd }` line is replaced by the combined import above; keep the existing `geoCostMetric`.)

- [ ] **Step 4: Route the report headline through it, with gating**

In `lib/marketing/report-html.ts`, replace the GEO mention stat (the `percentValue(...)` line from sub-project 1):

```ts
      <div class="stat"><span>GEO mention</span><strong>${(() => {
        const m = geoMentionMetric({ brandMentionRate: report.scoreboard.geoMentionRate, sampleSize: report.scoreboard.geoSampleSize });
        return isReliable(m) ? formatMetric(m) : gateMessage(m);
      })()}</strong></div>
```

Update the imports at the top of `report-html.ts`:

```ts
import { geoMentionMetric } from "@/lib/marketing/metrics-view";
import { formatMetric, gateMessage, isReliable } from "@/lib/metrics/format";
```

(Remove the now-unused `percentValue` import if it is no longer referenced.)

- [ ] **Step 5: Run the test and the existing render regression**

Run: `npx vitest run tests/unit/geo-mention-metric.test.ts tests/unit/geo-percent-render.test.ts`
Expected: PASS. In `geo-percent-render.test.ts` the n=25 fixture renders `40%` (reliable), so the existing assertions still hold.

- [ ] **Step 6: Commit**

```bash
git add lib/marketing/metrics-view.ts lib/marketing/report-html.ts tests/unit/geo-mention-metric.test.ts
git commit -m "feat(marketing): GEO mention metric carries its Wilson interval and gates below n=20"
```

---

### Task 4: Interval-derived confidence in geo-metrics

**Files:**
- Modify: `lib/engines/geo-metrics.ts`
- Test: `tests/unit/geo-metrics-confidence.test.ts`

**Interfaces:**
- Consumes: `wilsonInterval`, `metricConfidence`, `MIN_RELIABLE` (Task 1)
- Produces: unchanged `GeoVariabilityMetrics` shape; `confidence` now interval-derived

- [ ] **Step 1: Write the failing test**

Create `tests/unit/geo-metrics-confidence.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeGeoVariability } from "@/lib/engines/geo-metrics";
import type { GeoResult } from "@/lib/analyze/types";

function geo(mentions: number, n: number): GeoResult {
  return {
    runId: "r",
    model: "test-model",
    sampleSize: n,
    brandMentionRate: Math.round((mentions / n) * 100),
    firstPartyCitationShare: 0,
    observations: Array.from({ length: n }, (_, i) => ({
      id: `o${i}`,
      prompt: "p",
      rawResponse: "",
      brandMentioned: i < mentions,
      citations: [],
    })),
    errors: [],
    cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 },
  };
}

describe("geo-metrics confidence", () => {
  it("is Low for a tiny sample regardless of point value", () => {
    expect(computeGeoVariability(geo(2, 5)).confidence).toBe("Low");
  });

  it("rises only when the interval is tight enough on a real sample", () => {
    const wide = computeGeoVariability(geo(20, 40)); // p=0.5, still fairly wide
    const tight = computeGeoVariability(geo(2, 200)); // p=0.01, narrow
    expect(["Low", "Medium"]).toContain(wide.confidence);
    expect(["Medium", "High"]).toContain(tight.confidence);
  });

  it("labels carry the interval", () => {
    const m = computeGeoVariability(geo(16, 40));
    expect(m.labels.join(" ")).toMatch(/CI/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/geo-metrics-confidence.test.ts`
Expected: FAIL — labels have no `CI`; confidence uses the old `>= 8` rule.

- [ ] **Step 3: Swap the confidence derivation**

In `lib/engines/geo-metrics.ts`, add imports at the top:

```ts
import { MIN_RELIABLE, metricConfidence, wilsonInterval } from "@/lib/metrics/wilson";
```

Replace the confidence block (the `let confidence ...` and the two `if` lines):

```ts
  const successes = Math.round((brandMentionRate / 100) * sampleSize);
  const interval = wilsonInterval(successes, sampleSize);
  const level = metricConfidence(interval, { n: sampleSize, minReliable: MIN_RELIABLE.geoMentionRate });
  const confidence: GeoVariabilityMetrics["confidence"] =
    level === "high" ? "High" : level === "medium" ? "Medium" : "Low";
```

Replace the `labels` array construction to include the interval:

```ts
  const labels = [
    `Sample size n=${sampleSize}`,
    interval
      ? `${brandMentionRate}% (95% CI ${Math.round(interval.low)}–${Math.round(interval.high)}%)`
      : "No interval — insufficient sample",
    confidence === "Low" ? "Low confidence — treat as directional only" : `${confidence} confidence`,
  ];
  if (runToRunMentionStdev !== null) {
    labels.push(`Run-to-run mention stdev ${runToRunMentionStdev}pp across ${historyRates.length} runs`);
  }
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/unit/geo-metrics-confidence.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/engines/geo-metrics.ts tests/unit/geo-metrics-confidence.test.ts
git commit -m "fix(geo): derive variability confidence from the Wilson interval, not a count threshold"
```

---

### Task 5: Significance gate on run-to-run deltas

**Files:**
- Modify: `lib/engines/analyze-delta.ts` (`DeltaMetric`, `metric`, `compareAnalyzeSnapshots`)
- Test: `tests/unit/analyze-delta-significance.test.ts`

**Interfaces:**
- Consumes: `isSignificantChange` (Task 2)
- Produces: `DeltaMetric` gains `significant: boolean`; rate metrics only count as `improved` when the change is significant

- [ ] **Step 1: Write the failing test**

Create `tests/unit/analyze-delta-significance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { compareAnalyzeSnapshots } from "@/lib/engines/analyze-delta";
import type { AnalyzeSnapshot } from "@/lib/engines/analyze-delta";

function snap(rate: number, n: number, at: string): AnalyzeSnapshot {
  return {
    analyzedAt: at,
    seo: { score: 80, pagesScanned: 10, totalIssues: 0, critical: 0, high: 0 },
    geo: { sampleSize: n, brandMentionRate: rate, firstPartyCitationShare: 0 },
    nextActionIds: [],
    topActionTitles: [],
  } as AnalyzeSnapshot;
}

function rateMetric(d: ReturnType<typeof compareAnalyzeSnapshots>) {
  return d.metrics.find((m) => m.key === "brandMentionRate")!;
}

describe("analyze-delta significance", () => {
  it("does not call a noisy small change improved", () => {
    const d = compareAnalyzeSnapshots(snap(40, 5, "2026-07-01"), snap(42, 5, "2026-07-15"));
    const m = rateMetric(d);
    expect(m.significant).toBe(false);
    expect(m.improved).toBe(false);
  });

  it("calls a large change on a real sample improved", () => {
    const d = compareAnalyzeSnapshots(snap(10, 30, "2026-07-01"), snap(60, 30, "2026-07-15"));
    const m = rateMetric(d);
    expect(m.significant).toBe(true);
    expect(m.improved).toBe(true);
  });

  it("reports exact-count metrics as always significant", () => {
    const d = compareAnalyzeSnapshots(snap(40, 5, "2026-07-01"), snap(40, 5, "2026-07-15"));
    const seo = d.metrics.find((m) => m.key === "seoScore")!;
    expect(seo.significant).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/analyze-delta-significance.test.ts`
Expected: FAIL — `significant` is undefined; the noisy change is `improved`.

- [ ] **Step 3: Add the field and the gate**

In `lib/engines/analyze-delta.ts`, add `significant` to `DeltaMetric`:

```ts
  improved: boolean;
  higherIsBetter: boolean;
  /** For sampled rates, whether the change passed a two-proportion test. Exact counts are always true. */
  significant: boolean;
```

Add the import:

```ts
import { isSignificantChange } from "@/lib/metrics/significance";
```

Change `metric()` to accept an optional significance override and default exact metrics to significant:

```ts
function metric(
  key: string,
  label: string,
  before: number,
  after: number,
  unit: string,
  higherIsBetter: boolean,
  significant = true,
): DeltaMetric {
  const delta = Number((after - before).toFixed(2));
  const dir = direction(delta);
  const baseImproved = dir === "flat" ? false : higherIsBetter ? dir === "up" : dir === "down";
  const improved = significant && baseImproved;
  return { key, label, before, after, delta, unit, direction: dir, improved, higherIsBetter, significant };
}
```

In `compareAnalyzeSnapshots`, compute significance for the two rate metrics before building the array:

```ts
  const bN = baseline.geo.sampleSize;
  const cN = current.geo.sampleSize;
  const mentionSig = isSignificantChange(
    Math.round((baseline.geo.brandMentionRate / 100) * bN), bN,
    Math.round((current.geo.brandMentionRate / 100) * cN), cN,
  );
  const citationSig = isSignificantChange(
    Math.round((baseline.geo.firstPartyCitationShare / 100) * bN), bN,
    Math.round((current.geo.firstPartyCitationShare / 100) * cN), cN,
  );
```

Then pass them into the two rate `metric(...)` calls (the last argument):

```ts
    metric("brandMentionRate", "GEO brand mention rate", baseline.geo.brandMentionRate, current.geo.brandMentionRate, "%", true, mentionSig),
```

```ts
    metric(
      "firstPartyCitationShare",
      "First-party citation share",
      baseline.geo.firstPartyCitationShare,
      current.geo.firstPartyCitationShare,
      "%",
      true,
      citationSig,
    ),
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/unit/analyze-delta-significance.test.ts`
Expected: PASS.

- [ ] **Step 5: Full verification**

Run:
```bash
rm -rf .data && npm run typecheck && npm run lint && npm test && npm run build
```
Expected: all PASS, zero warnings, `.data/` absent after tests. If `analyze-delta.test.ts` asserts on a rate metric's `improved` without significance, update it: a rate change is now `improved` only when significant.

- [ ] **Step 6: Commit**

```bash
git add lib/engines/analyze-delta.ts tests/unit/analyze-delta-significance.test.ts
git commit -m "fix(delta): gate rate 'improved' behind a two-proportion significance test"
```

---

## What this plan does not cover

- **#3 Provenance UI** — primary surfaces render `gateMessage` below threshold; inspection surfaces show value + interval + n; every displayed figure carries its basis. The metric layer now supplies everything this needs.
- **#4 Scoring-model + constants** — readiness normalisation (portfolio-comparable), the priority-saturation fix (`impact×confidence×relevance/effort` clamping at 100), and the constant-provenance registry.
