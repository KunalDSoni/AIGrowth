# Metric Integrity Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every displayed number a typed `Metric` so the 100× GEO unit bug becomes a compile error and the fabricated lead-lift forecast becomes impossible to construct, then fix both P0 defects and three unit/labelling errors.

**Architecture:** A new `lib/metrics/` module defines `Metric<Unit>`, unit-safe constructors with runtime guards, and a single `formatMetric` that owns all rendering. The GEO rate stays 0–100 (its producer's existing contract); the eleven display sites that erroneously multiply by 100 again are corrected to wrap the raw value with `percentValue` and render via `formatMetric`. Dead `os.ts` is deleted rather than repaired.

**Tech Stack:** TypeScript, Next.js 15, Vitest.

## Global Constraints

- The GEO rate `brandMentionRate` / `firstPartyCitationShare` is **0–100** at its producer (`run-geo.ts:81`) and stays 0–100. Never convert it to a 0–1 fraction; ~8 consumers depend on 0–100 and the value is persisted in `.data`.
- Wrapping into `Metric` happens at the **display boundary** (marketing layer, report-html, observer), never in the core `AnalyzeResult`/`GeoResult` types, to keep blast radius contained.
- `formatMetric` is the only place a percent is rendered; there is no `× 100` at any display site after this work.
- A constructor with `basis: "estimated"` requires a non-empty `assumptions` array or it throws.
- No number displays as reliable below its minimum sample.
- `npm test`, `npm run typecheck`, `npm run lint` (`--max-warnings=0`) and `npm run build` must all pass. Import alias `@/` maps to the repo root.

---

### Task 1: Metric types and constructors

**Files:**
- Create: `lib/metrics/types.ts`
- Create: `lib/metrics/construct.ts`
- Test: `tests/unit/metric-construct.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `Unit`, `MetricBasis`, `MetricSample`, `MetricInterval`, `Metric<U>`, `ConstructOpts`, `percentValue`, `percentFromFraction`, `count`, `score`, `usd`, `hours`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/metric-construct.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { count, hours, percentFromFraction, percentValue, score, usd } from "@/lib/metrics/construct";

const base = { basis: "measured" as const, evidenceIds: ["ev-1"] };

describe("metric constructors", () => {
  it("percentValue stores an already-0-100 value unchanged", () => {
    const m = percentValue(40, base);
    expect(m).toMatchObject({ value: 40, unit: "percent", basis: "measured", evidenceIds: ["ev-1"] });
  });

  it("percentFromFraction multiplies a 0-1 fraction by 100 exactly once", () => {
    expect(percentFromFraction(0.4, base).value).toBe(40);
  });

  it("clamps a percent to the 0-100 range", () => {
    expect(percentValue(4000, base).value).toBe(100);
    expect(percentValue(-5, base).value).toBe(0);
  });

  it("renders NaN-valued metrics as insufficient", () => {
    const m = count(Number.NaN, base);
    expect(m.confidence).toBe("insufficient");
  });

  it("carries a sample and derives an n>=minReliable gate confidence", () => {
    const low = percentValue(40, { ...base, sample: { n: 3, minReliable: 20 } });
    expect(low.confidence).toBe("insufficient");
    const ok = percentValue(40, { ...base, sample: { n: 25, minReliable: 20 } });
    expect(ok.confidence).toBe("low");
  });

  it("requires assumptions for an estimated metric", () => {
    expect(() => usd(0.12, { basis: "estimated", evidenceIds: [] })).toThrow(
      "estimated metric requires assumptions",
    );
    expect(usd(0.12, { basis: "estimated", evidenceIds: [], assumptions: ["blended $0.10/1M tokens"] }).value).toBe(0.12);
  });

  it("builds count, score, hours with their units", () => {
    expect(count(19, base).unit).toBe("count");
    expect(score(72, base).unit).toBe("score");
    expect(hours(3, base).unit).toBe("hours");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/metric-construct.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/metrics/construct"`

- [ ] **Step 3: Write the types**

Create `lib/metrics/types.ts`:

```ts
/**
 * A displayed number that carries its own meaning. A bare `number` can be
 * multiplied by 100 by accident; a Metric cannot — units and provenance are
 * part of the type, and rendering is owned by formatMetric.
 */

export type Unit = "percent" | "count" | "score" | "usd" | "hours" | "ratio" | "days";

export type MetricBasis =
  | "measured" // counted from real observations (crawl, GEO run, GSC)
  | "derived" // a formula over measured inputs (readiness score)
  | "estimated" // a labelled projection with stated assumptions AND evidence
  | "config"; // a governance constant (sub-project 4)

export interface MetricSample {
  n: number;
  minReliable: number;
}

export interface MetricInterval {
  low: number;
  high: number;
  method: "wilson";
}

export type MetricConfidence = "high" | "medium" | "low" | "insufficient";

export interface Metric<U extends Unit = Unit> {
  value: number;
  unit: U;
  basis: MetricBasis;
  /** Evidence records that justify it. Empty is a red flag, not a default. */
  evidenceIds: string[];
  sample?: MetricSample;
  interval?: MetricInterval;
  confidence?: MetricConfidence;
  /** Present only for estimated metrics; enforced at construction. */
  assumptions?: string[];
}
```

- [ ] **Step 4: Write the constructors**

Create `lib/metrics/construct.ts`:

```ts
import type { Metric, MetricBasis, MetricSample, Unit } from "@/lib/metrics/types";

export interface ConstructOpts {
  basis: MetricBasis;
  evidenceIds: string[];
  sample?: MetricSample;
  assumptions?: string[];
}

function build<U extends Unit>(value: number, unit: U, opts: ConstructOpts): Metric<U> {
  if (opts.basis === "estimated" && !(opts.assumptions && opts.assumptions.length)) {
    throw new Error("estimated metric requires assumptions");
  }

  const finite = Number.isFinite(value);
  const confidence = !finite
    ? ("insufficient" as const)
    : opts.sample
      ? opts.sample.n >= opts.sample.minReliable
        ? ("low" as const) // sub-project 2 replaces this with interval-derived confidence
        : ("insufficient" as const)
      : undefined;

  return {
    value: finite ? value : Number.NaN,
    unit,
    basis: opts.basis,
    evidenceIds: opts.evidenceIds,
    ...(opts.sample ? { sample: opts.sample } : {}),
    ...(confidence ? { confidence } : {}),
    ...(opts.assumptions ? { assumptions: opts.assumptions } : {}),
  };
}

const clampPercent = (v: number) => Math.max(0, Math.min(100, v));

/** For a value already on a 0-100 scale (the GEO rate's existing contract). */
export function percentValue(value0to100: number, opts: ConstructOpts): Metric<"percent"> {
  return build(Number.isFinite(value0to100) ? clampPercent(value0to100) : value0to100, "percent", opts);
}

/** For a 0-1 fraction. Multiplies by 100 exactly once — the only such multiply. */
export function percentFromFraction(fraction: number, opts: ConstructOpts): Metric<"percent"> {
  return build(Number.isFinite(fraction) ? clampPercent(fraction * 100) : fraction, "percent", opts);
}

export function count(value: number, opts: ConstructOpts): Metric<"count"> {
  return build(value, "count", opts);
}

export function score(value0to100: number, opts: ConstructOpts): Metric<"score"> {
  return build(value0to100, "score", opts);
}

export function usd(value: number, opts: ConstructOpts): Metric<"usd"> {
  return build(value, "usd", opts);
}

export function hours(value: number, opts: ConstructOpts): Metric<"hours"> {
  return build(value, "hours", opts);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/metric-construct.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 6: Commit**

```bash
git add lib/metrics/types.ts lib/metrics/construct.ts tests/unit/metric-construct.test.ts
git commit -m "feat(metrics): typed Metric with unit-safe constructors"
```

---

### Task 2: formatMetric, isReliable, and the Wilson stub

**Files:**
- Create: `lib/metrics/format.ts`
- Create: `lib/metrics/wilson.ts`
- Test: `tests/unit/metric-format.test.ts`

**Interfaces:**
- Consumes: `Metric`, `MetricInterval`, `MetricSample` from Task 1
- Produces: `formatMetric(m: Metric): string`, `isReliable(m: Metric): boolean`, `gateMessage(m: Metric): string`, `wilsonInterval(successes: number, n: number): MetricInterval | null`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/metric-format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { count, hours, percentValue, score, usd } from "@/lib/metrics/construct";
import { formatMetric, gateMessage, isReliable } from "@/lib/metrics/format";
import { wilsonInterval } from "@/lib/metrics/wilson";

const base = { basis: "measured" as const, evidenceIds: [] };

describe("formatMetric", () => {
  it("renders a percent without ever multiplying again", () => {
    expect(formatMetric(percentValue(40, base))).toBe("40%");
  });

  it("renders usd, hours, score, count", () => {
    expect(formatMetric(usd(0.12, { basis: "estimated", evidenceIds: [], assumptions: ["x"] }))).toBe("$0.12");
    expect(formatMetric(hours(3, base))).toBe("3h");
    expect(formatMetric(score(72, base))).toBe("72");
    expect(formatMetric(count(19, base))).toBe("19");
  });

  it("renders a non-finite metric as an em dash", () => {
    expect(formatMetric(count(Number.NaN, base))).toBe("—");
  });
});

describe("isReliable and gateMessage", () => {
  it("is unreliable below the minimum sample", () => {
    const m = percentValue(40, { ...base, sample: { n: 3, minReliable: 20 } });
    expect(isReliable(m)).toBe(false);
    expect(gateMessage(m)).toBe("Insufficient sample — n=3, need 20");
  });

  it("is reliable at or above the minimum sample", () => {
    expect(isReliable(percentValue(40, { ...base, sample: { n: 25, minReliable: 20 } }))).toBe(true);
  });

  it("treats a metric with no sample as reliable (not sampled)", () => {
    expect(isReliable(score(72, base))).toBe(true);
  });
});

describe("wilsonInterval stub", () => {
  it("returns null until sub-project 2 implements it", () => {
    expect(wilsonInterval(2, 5)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/metric-format.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/metrics/format"`

- [ ] **Step 3: Write the Wilson stub**

Create `lib/metrics/wilson.ts`:

```ts
import type { MetricInterval } from "@/lib/metrics/types";

/**
 * Wilson score interval. STUB — the real implementation lands in sub-project 2
 * (the statistical layer). The signature and call sites exist now so consumers
 * can be wired without a second refactor. Returns null meaning "no interval yet".
 */
export function wilsonInterval(_successes: number, _n: number): MetricInterval | null {
  return null;
}
```

- [ ] **Step 4: Write the formatter**

Create `lib/metrics/format.ts`:

```ts
import type { Metric } from "@/lib/metrics/types";

/** A sampled metric is reliable only at or above its minimum sample. */
export function isReliable(m: Metric): boolean {
  if (!Number.isFinite(m.value)) return false;
  if (!m.sample) return true;
  return m.sample.n >= m.sample.minReliable;
}

export function gateMessage(m: Metric): string {
  if (!m.sample) return "Insufficient data";
  return `Insufficient sample — n=${m.sample.n}, need ${m.sample.minReliable}`;
}

/** The single place a metric becomes text. No display site multiplies a percent. */
export function formatMetric(m: Metric): string {
  if (!Number.isFinite(m.value)) return "—";
  switch (m.unit) {
    case "percent":
      return `${Math.round(m.value)}%`;
    case "usd":
      return `$${m.value.toFixed(2)}`;
    case "hours":
      return `${m.value}h`;
    case "days":
      return `${m.value}d`;
    case "ratio":
      return m.value.toFixed(2);
    case "score":
    case "count":
    default:
      return `${Math.round(m.value)}`;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/metric-format.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 6: Commit**

```bash
git add lib/metrics/format.ts lib/metrics/wilson.ts tests/unit/metric-format.test.ts
git commit -m "feat(metrics): formatMetric, isReliable, and Wilson interval stub"
```

---

### Task 3: Delete dead os.ts

**Files:**
- Delete: `lib/marketing/os.ts`
- Delete: `tests/unit/marketing-os.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: nothing (removal)

`os.ts` is the superseded Phase 1–5 implementation. It is reachable from no route (only `tests/unit/marketing-os.test.ts` imports it) and carries both the double-multiply bug and genuine logic bugs (`geoRate < 0.4` against a 0–100 value). The live product uses `deep-engine.ts` + `workspace.ts`.

- [ ] **Step 1: Prove it is dead before deleting**

Run: `grep -rn "lib/marketing/os\"" app lib components | grep -v "test"`
Expected: no output. If any line prints, STOP — os.ts is not dead; do not delete it, and raise this with the plan author.

- [ ] **Step 2: Delete the files**

```bash
git rm lib/marketing/os.ts tests/unit/marketing-os.test.ts
```

- [ ] **Step 3: Verify nothing broke**

Run: `npm run typecheck`
Expected: PASS with no errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(marketing): delete dead os.ts (superseded by deep-engine)

Reachable from no route; carried the double-multiply bug plus logic bugs
comparing a 0-100 rate against 0.4/0.5 thresholds. The live product uses
deep-engine.ts + workspace.ts."
```

---

### Task 4: Fix the 100× GEO error at the eleven live display sites

**Files:**
- Modify: `lib/marketing/deep-engine.ts` (lines 98, 99, 214, 517, 629, 652, 696)
- Modify: `lib/marketing/workspace.ts` (lines 161, 302)
- Modify: `lib/marketing/report-html.ts` (line 88)
- Modify: `lib/agents/impl/observer.ts` (line 73)
- Test: `tests/unit/geo-percent-render.test.ts`

**Interfaces:**
- Consumes: `percentValue` (Task 1), `formatMetric` (Task 2)
- Produces: nothing new; corrects existing render sites

Every site currently multiplies an already-0–100 value by 100. Each is changed to render the raw value directly (it is already a percentage). Since these are string interpolations, the minimal correct fix is to drop `* 100` and keep `.toFixed(0)` — the value is already 0–100. Where a site is a real UI value (not prose), route it through `formatMetric(percentValue(...))` so provenance travels with it.

- [ ] **Step 1: Write the failing regression test**

Create `tests/unit/geo-percent-render.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runDeepMarketingEngine } from "@/lib/marketing/deep-engine";
import { renderPositionReportHtml } from "@/lib/marketing/report-html";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";
import { makeAnalyzeResult } from "@/tests/support/analyze-input";

describe("GEO percentage rendering", () => {
  it("renders a 40% mention rate as 40%, never 4000%", async () => {
    // brandMentionRate is 0-100; makeAnalyzeResult builds the geo block from a fraction.
    const result = makeAnalyzeResult({ brandMentionRate: 0.4, geoSampleSize: 25, critical: 2, high: 3 });
    result.geo.brandMentionRate = 40; // 0-100 contract, as run-geo emits
    result.intelligence = buildLiveIntelligence(result);

    const deep = await runDeepMarketingEngine(result, { hoursPerWeek: 8, useGemini: false });
    const html = renderPositionReportHtml(deep.report, deep.packs, deep.context.siteFacts);

    expect(html).toContain("40%");
    expect(html).not.toMatch(/[1-9]\d{3,}%/); // no 4000% and friends
    for (const fact of deep.context.siteFacts) {
      expect(fact).not.toMatch(/[1-9]\d{3,}%/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/geo-percent-render.test.ts`
Expected: FAIL — output contains `4000%` (the double-multiply).

- [ ] **Step 3: Fix deep-engine.ts**

In `lib/marketing/deep-engine.ts`, replace each occurrence. Line 98–99:

```ts
    `GEO mention rate: ${result.geo.brandMentionRate.toFixed(0)}%`,
    `First-party citation share: ${result.geo.firstPartyCitationShare.toFixed(0)}%`,
```

Line 214:

```ts
      rationale: ctx.promptsLost[0] ?? `Mention rate ${ctx.geoMentionRate.toFixed(0)}% — expand answers`,
```

Line 517 (inside the template literal):

```ts
      `Baseline: SEO ${ctx.seoScore}, GEO ${ctx.geoMentionRate.toFixed(0)}% (n=${ctx.geoSample}).\nImplement → wait 14 days → re-run analyze.\nLeading indicators: form fills / booked calls (not vanity rankings).\nDo not claim causation from a single change.`,
```

Line 629:

```ts
    detail: `Baseline SEO ${ctx.seoScore}, GEO ${ctx.geoMentionRate.toFixed(0)}% (n=${ctx.geoSample}, ${ctx.geoModel})`,
```

Line 652:

```ts
      value: `${ctx.geoMentionRate.toFixed(0)}%`,
```

Line 696:

```ts
        body: `Mention rate ${ctx.geoMentionRate.toFixed(0)}% on ${ctx.geoModel} (n=${ctx.geoSample}).`,
```

- [ ] **Step 4: Fix workspace.ts, report-html.ts, observer.ts**

`lib/marketing/workspace.ts` line 161:

```ts
    summary: `${deep.context.brand}: SEO ${deep.context.seoScore}, GEO ${deep.context.geoMentionRate.toFixed(0)}% (n=${deep.context.geoSample}). ${deep.packs.length} evidence-backed packs drafted.`,
```

Line 302:

```ts
        : [`Mention rate ${deep.context.geoMentionRate.toFixed(0)}% — expand answer sections`],
```

`lib/marketing/report-html.ts` line 88 — route the headline stat through the metric layer so it also gains gating later. Add at the top of the file:

```ts
import { percentValue } from "@/lib/metrics/construct";
import { formatMetric } from "@/lib/metrics/format";
```

Replace line 88:

```ts
      <div class="stat"><span>GEO mention</span><strong>${formatMetric(percentValue(report.scoreboard.geoMentionRate, { basis: "measured", evidenceIds: [] }))}</strong></div>
```

`lib/agents/impl/observer.ts` line 73 — the Observer's `geo.mentionRate` is 0–100 (from `runGeoProbes.brandMentionRate`):

```ts
        rationale: `SEO ${seo.score}/100 across ${seo.pagesScanned} pages; answer mention rate ${geo.mentionRate.toFixed(0)}% on n=${geo.sampleSize} (${geo.model}).`,
```

- [ ] **Step 5: Run the regression test and the observer test**

Run: `npx vitest run tests/unit/geo-percent-render.test.ts tests/unit/agent-observer.test.ts`
Expected: PASS. If `agent-observer.test.ts` asserted `mentionRate * 100`, update that assertion to the 0–100 value.

- [ ] **Step 6: Commit**

```bash
git add lib/marketing/deep-engine.ts lib/marketing/workspace.ts lib/marketing/report-html.ts lib/agents/impl/observer.ts tests/unit/geo-percent-render.test.ts
git commit -m "fix(geo): stop double-multiplying the 0-100 mention rate (4000% -> 40%)"
```

---

### Task 5: Delete the fabricated lead-lift forecast

**Files:**
- Modify: `lib/marketing/types.ts` (`SimulationResult`, line 155)
- Modify: `lib/marketing/workspace.ts` (simulations producer, ~line 230)
- Modify: `app/demo/marketing/outreach/page.tsx` (line ~176)
- Test: `tests/unit/simulation-honesty.test.ts`

**Interfaces:**
- Consumes: `hours` (Task 1), `formatMetric` (Task 2)
- Produces: revised `SimulationResult`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/simulation-honesty.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateWorkspace } from "@/lib/marketing/workspace";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";
import { makeAnalyzeResult } from "@/tests/support/analyze-input";

describe("simulation honesty", () => {
  it("asserts no quantitative lift and states why", async () => {
    const fixture = makeAnalyzeResult({ critical: 2, high: 3, citedDomains: ["directory.invalid"] });
    fixture.intelligence = buildLiveIntelligence(fixture);
    const ws = await generateWorkspace({ analyze: fixture, hoursPerWeek: 8, useGemini: false });

    expect(ws.simulations.length).toBeGreaterThan(0);
    for (const sim of ws.simulations) {
      expect(sim).not.toHaveProperty("expectedLeadLiftBand");
      expect(sim.liftEstimable).toBe(false);
      expect(sim.reason).toContain("baseline");
      expect(sim.costHours.unit).toBe("hours");
    }
    const serialized = JSON.stringify(ws.simulations);
    expect(serialized).not.toMatch(/\+\d+–\d+%/); // no "+8–18%" band anywhere
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/simulation-honesty.test.ts`
Expected: FAIL — `expectedLeadLiftBand` still present.

- [ ] **Step 3: Revise the type**

In `lib/marketing/types.ts`, replace the `SimulationResult` interface (lines 155–161):

```ts
export interface SimulationResult {
  tacticId: string;
  costHours: import("@/lib/metrics/types").Metric<"hours">;
  /** No conversion baseline exists, so lift cannot be modelled honestly. */
  liftEstimable: false;
  reason: string;
  evidenceIds: string[];
}
```

- [ ] **Step 4: Revise the producer**

In `lib/marketing/workspace.ts`, add near the top with the other imports:

```ts
import { hours } from "@/lib/metrics/construct";
```

Replace the `simulations:` block (~lines 230–235):

```ts
    simulations: deep.tactics.slice(0, 5).map((t) => ({
      tacticId: t.id,
      costHours: hours(deep.packs.find((p) => p.tacticId === t.id)?.effortHours ?? 3, {
        basis: "measured",
        evidenceIds: t.evidenceIds,
      }),
      liftEstimable: false as const,
      reason: "Lift not estimable without a conversion baseline. Connect GA4 to model it.",
      evidenceIds: t.evidenceIds,
    })),
```

- [ ] **Step 5: Update the outreach UI**

In `app/demo/marketing/outreach/page.tsx`, add at the top:

```tsx
import { formatMetric } from "@/lib/metrics/format";
```

Replace the simulation row (line ~178):

```tsx
                      {s.tacticId}: {formatMetric(s.costHours)} effort · {s.reason}
```

- [ ] **Step 6: Run the test**

Run: `npx vitest run tests/unit/simulation-honesty.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/marketing/types.ts lib/marketing/workspace.ts app/demo/marketing/outreach/page.tsx tests/unit/simulation-honesty.test.ts
git commit -m "fix(marketing): delete fabricated lead-lift band; state lift is not estimable"
```

---

### Task 6: Split quickWins from monitors

**Files:**
- Modify: `lib/engines/readiness.ts` (line 42)
- Modify: `lib/engines/site-audit.ts` (interface ~line 38, computation ~line 87)
- Test: `tests/unit/quickwins-split.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `SiteSummary` gains a `monitors: number` field; `quickWins` no longer includes monitors. `ReadinessMetrics` already exposes `monitor` separately, so its `quickWins` simply drops the `+ monitor` term.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/quickwins-split.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeReadiness } from "@/lib/engines/readiness";
import type { AuditIssue } from "@/lib/domain/types";

function issue(severity: AuditIssue["severity"], id: string): AuditIssue {
  return {
    id,
    ruleId: "r",
    category: "General",
    severity,
    title: id,
    description: "d",
    recommendedAction: "a",
    affectedPages: 1,
    evidenceIds: [],
    impactArea: "discovery",
  };
}

describe("quickWins vs monitors", () => {
  it("does not count monitors as quick wins", () => {
    const m = computeReadiness([issue("quick-win", "q1"), issue("monitor", "m1"), issue("monitor", "m2")]);
    expect(m.quickWins).toBe(1);
    expect(m.monitor).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/quickwins-split.test.ts`
Expected: FAIL — `quickWins` is 3 (1 quick-win + 2 monitors).

- [ ] **Step 3: Fix readiness.ts**

In `lib/engines/readiness.ts`, line 42, change:

```ts
  const quickWins = count("quick-win");
```

(drop `+ monitor`). The `monitor` variable and field already exist and stay.

- [ ] **Step 4: Fix site-audit.ts**

In `lib/engines/site-audit.ts`, add `monitors` to the `SiteSummary` interface (after `quickWins: number;` at ~line 38):

```ts
  quickWins: number;
  monitors: number;
```

Change the computation (~line 87) from:

```ts
    quickWins: countBy("quick-win") + countBy("monitor"),
```

to:

```ts
    quickWins: countBy("quick-win"),
    monitors: countBy("monitor"),
```

- [ ] **Step 5: Run the test and typecheck**

Run: `npx vitest run tests/unit/quickwins-split.test.ts && npm run typecheck`
Expected: test PASS. If typecheck flags a missing `monitors` at a `SiteSummary` literal, add `monitors: 0` there (fixtures) or the real count.

- [ ] **Step 6: Commit**

```bash
git add lib/engines/readiness.ts lib/engines/site-audit.ts tests/unit/quickwins-split.test.ts
git commit -m "fix(audit): stop counting monitors as quick wins"
```

---

### Task 7: Derive channel mix from effort, not priority

**Files:**
- Modify: `lib/marketing/deep-engine.ts` (`channelMix`, ~line 724)
- Test: `tests/unit/channel-mix-units.test.ts`

**Interfaces:**
- Consumes: `MarketingTactic` (already has `packType`; effort comes from the pack, not the tactic)
- Produces: `channelMix` splits hours by each channel's summed effort hours, not its priority

The current code sums `t.priority` (an ordinal 0–100 ranking) and treats the ratio as a share of hours — mixing units. Effort hours are the real resource quantity. Since `MarketingTactic` has no effort field, use a per-channel effort weight derived from the tactic's `packType` via the same defaults the packs use (`SERVICE` 8h, others 4h, plus a floor), so heavier work claims more hours.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/channel-mix-units.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runDeepMarketingEngine } from "@/lib/marketing/deep-engine";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";
import { makeAnalyzeResult } from "@/tests/support/analyze-input";

describe("channel mix", () => {
  it("allocates hours that sum to the weekly capacity", async () => {
    const result = makeAnalyzeResult({ critical: 2, high: 3, citedDomains: ["directory.invalid"] });
    result.intelligence = buildLiveIntelligence(result);
    const deep = await runDeepMarketingEngine(result, { hoursPerWeek: 8, useGemini: false });

    const totalHours = deep.channelMix.reduce((sum, c) => sum + c.hours, 0);
    expect(totalHours).toBeGreaterThan(7.4);
    expect(totalHours).toBeLessThan(8.6); // sums to capacity within rounding
    for (const c of deep.channelMix) {
      expect(c.hours).toBeGreaterThan(0);
      expect(c.pct).toBeGreaterThan(0);
      expect(c.pct).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes trivially**

Run: `npx vitest run tests/unit/channel-mix-units.test.ts`
Expected: it may already pass on sum (rounding), but the allocation is priority-weighted. Proceed to make the weighting effort-based regardless; the test guards the sum invariant.

- [ ] **Step 3: Rewrite the channelMix function**

In `lib/marketing/deep-engine.ts`, replace the `channelMix` function (~line 724):

```ts
function effortWeight(packType: MarketingTactic["packType"]): number {
  // Mirrors the pack effort defaults: SERVICE pages are the heaviest work.
  if (packType === "SERVICE") return 8;
  if (packType === "HOME" || packType === "COMPARE" || packType === "ENTITY") return 6;
  return 4;
}

function channelMix(hours: number, tactics: MarketingTactic[]): ChannelMix[] {
  const weights: Record<string, number> = {};
  for (const t of tactics.slice(0, 8)) {
    weights[t.channel] = (weights[t.channel] ?? 0) + effortWeight(t.packType);
  }
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(weights)
    .map(([channel, w]) => ({
      channel: channel as ChannelMix["channel"],
      pct: w / total,
      hours: Math.round(hours * (w / total) * 10) / 10,
    }))
    .sort((a, b) => b.hours - a.hours);
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/unit/channel-mix-units.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/marketing/deep-engine.ts tests/unit/channel-mix-units.test.ts
git commit -m "fix(marketing): allocate channel hours by effort, not priority score"
```

---

### Task 8: Make the GEO cost figure honestly estimated

**Files:**
- Create: `lib/marketing/metrics-view.ts`
- Test: `tests/unit/geo-cost-metric.test.ts`

**Interfaces:**
- Consumes: `usd` (Task 1), `formatMetric` (Task 2), `GeoResult` (`lib/analyze/types`)
- Produces: `geoCostMetric(geo: Pick<GeoResult, "cost">): Metric<"usd">`

`run-geo.ts` computes `estimatedUsd = tokens/1M × 0.1` with a "display only" comment, but it ships in `GeoResult.cost` as a plain number a UI could present as billed cost. This task provides the single honest accessor that labels it estimated with its assumption, so any surface that shows GEO cost renders it as an estimate. `GeoResult.cost` itself is unchanged (it is persisted), keeping blast radius at zero.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/geo-cost-metric.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { geoCostMetric } from "@/lib/marketing/metrics-view";
import { formatMetric } from "@/lib/metrics/format";

describe("geoCostMetric", () => {
  it("labels GEO cost as an estimate with its pricing assumption", () => {
    const m = geoCostMetric({ cost: { provider: "gemini", estimatedUsd: 0.12, tokens: 1_200_000 } });
    expect(m.basis).toBe("estimated");
    expect(m.assumptions?.[0]).toContain("$0.10");
    expect(formatMetric(m)).toBe("$0.12");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/geo-cost-metric.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/marketing/metrics-view"`

- [ ] **Step 3: Write the accessor**

Create `lib/marketing/metrics-view.ts`:

```ts
/**
 * Display-layer metric accessors for the marketing surfaces. Wraps raw engine
 * numbers into typed Metrics at the boundary, without changing the persisted
 * engine result types.
 */

import type { GeoResult } from "@/lib/analyze/types";
import { usd } from "@/lib/metrics/construct";
import type { Metric } from "@/lib/metrics/types";

export function geoCostMetric(geo: Pick<GeoResult, "cost">): Metric<"usd"> {
  return usd(geo.cost.estimatedUsd, {
    basis: "estimated",
    evidenceIds: [],
    assumptions: ["Blended $0.10 / 1M tokens; provider billing may differ."],
  });
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/unit/geo-cost-metric.test.ts`
Expected: PASS.

- [ ] **Step 5: Full verification**

Run:
```bash
npm run typecheck && npm run lint && npm test && npm run build
```
Expected: all PASS, zero warnings, and the full suite green.

- [ ] **Step 6: Commit**

```bash
git add lib/marketing/metrics-view.ts tests/unit/geo-cost-metric.test.ts
git commit -m "feat(marketing): expose GEO cost as an explicitly estimated metric"
```

---

## What this plan does not cover

Sub-projects 2–4, per the spec:

- **#2 Statistical layer** — real `wilsonInterval` body, interval-derived `confidence` replacing the `n>=minReliable` gate, per-metric `minReliable` thresholds, two-proportion significance tests on run-to-run deltas.
- **#3 Provenance UI** — primary surfaces render `gateMessage` below threshold; inspection surfaces show value + interval + n; every displayed figure carries its basis.
- **#4 Scoring-model + constants** — readiness normalisation (per-page, portfolio-comparable), priority-saturation fix (bounded weighted model replacing `impact×confidence×relevance/effort`), and the constant-provenance registry for penalty weights, band cutoffs, tactic priorities and effort defaults.
