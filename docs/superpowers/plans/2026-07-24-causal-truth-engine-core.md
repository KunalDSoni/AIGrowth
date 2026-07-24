# Causal Truth Engine — Core Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the offline causal core that turns a marketing intervention + outcome data into an honestly-labelled lift estimate, choosing the strongest feasible experimental design automatically.

**Architecture:** A new `lib/causal/` module with focused, pure files: shared types, an in-memory Intervention Ledger, outcome-series helpers behind an injectable provider, a power/feasibility calculator, a Truth-Ladder design selector, a lift estimator (diff-in-differences for experiments + a synthetic-control fallback), and an orchestrator. A synthetic ground-truth generator lives in `tests/support/` so estimators can be verified against a known injected lift. One `POST /api/causal` route runs the whole thing against fixture data for a demoable end-to-end path.

**Tech Stack:** TypeScript, Next.js 15 App Router, Vitest. No new dependencies — statistics are implemented in-module, consistent with existing `lib/metrics/`.

## Global Constraints

- Path alias `@/` maps to repo root (e.g. `@/lib/causal/types`). Copy this import style from existing engines.
- No new npm dependencies. Implement statistics in-module (matches `lib/metrics/significance.ts`, `lib/metrics/wilson.ts`).
- Honest labelling is non-negotiable: every lift result carries a `ConfidenceLabel`; thin/underpowered data yields `"insufficient"` and **no** declared winner. Estimates are labelled `basis: "estimated"`; experiments `basis: "measured"`.
- Never auto-move money or auto-publish. This core plan does neither (Budget Governor is a follow-on plan); keep it that way.
- Test files go in `tests/unit/` and `tests/integration/`; shared test fixtures in `tests/support/`.
- Follow existing formatting: 2-space indent, double-quoted imports, named exports.

## File Structure

- `lib/causal/types.ts` — all shared types (single source of truth for signatures).
- `lib/causal/ledger.ts` — in-memory Intervention Ledger.
- `lib/causal/outcomes.ts` — `OutcomeStreamProvider` contract + series helpers (`splitAround`, `mean`).
- `lib/causal/power.ts` — feasibility / minimum-detectable-effect calculator.
- `lib/causal/estimator.ts` — `diffInDiff` + `syntheticControl` lift estimators.
- `lib/causal/ladder.ts` — Truth-Ladder design selector (`selectDesign`).
- `lib/causal/engine.ts` — `runCausalTest` orchestrator + `CausalReport`.
- `app/api/causal/route.ts` — demoable POST endpoint over fixture data.
- `tests/support/causal-synthetic.ts` — synthetic ground-truth generator.
- `tests/unit/causal-*.test.ts`, `tests/integration/causal-api.test.ts` — tests.

**Follow-on plans (out of scope here):** Budget Governor, Google Ads outcome/spend adapter, Learn-loop reweighting into the Next-Best-Action ranker, and the dashboard UI.

---

### Task 1: Shared types + Intervention Ledger

**Files:**
- Create: `lib/causal/types.ts`
- Create: `lib/causal/ledger.ts`
- Test: `tests/unit/causal-ledger.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: all core types (below), and `createInMemoryLedger(seed?: Intervention[]): InterventionLedger` where `InterventionLedger = { record(i: Intervention): void; list(): Intervention[]; get(id: string): Intervention | undefined }`.

- [ ] **Step 1: Write the types file**

```typescript
// lib/causal/types.ts

export type ChannelId = string;

export interface Intervention {
  id: string;
  channel: ChannelId;
  hypothesis: string;
  startedAt: string; // ISO timestamp
  endedAt?: string; // ISO timestamp
  geoScope?: string; // market id, when geo-scoped
  spendDeltaUsd?: number;
  metadata?: Record<string, string | number | boolean>;
}

export type OutcomeUnit = "conversions" | "revenue" | "clicks" | "signups";

export interface OutcomePoint {
  period: string; // ISO date of the bucket (e.g. a day)
  value: number;
  n?: number;
}

export interface OutcomeSeries {
  unit: OutcomeUnit;
  points: OutcomePoint[];
}

export interface AccountConstraints {
  markets: number; // distinct geographic markets available
  dailyOutcomeVolume: number; // typical outcomes/day (for power)
  canPulseBudget: boolean; // can spend be toggled on/off?
}

export type Rung =
  | "geo_holdout"
  | "time_pulse"
  | "switchback"
  | "synthetic_control"
  | "observational";

export type ConfidenceLabel =
  | "high_causal"
  | "good_causal_temporal"
  | "directional_modeled"
  | "insufficient";

export interface ExperimentDesign {
  rung: Rung;
  label: ConfidenceLabel;
  minWindowDays: number;
  rationale: string;
}

export interface Feasibility {
  minDetectableEffectPct: number; // relative MDE at the window
  windowDays: number;
  adequatelyPowered: boolean;
  note: string;
}

export interface LiftResult {
  liftPct: number; // point estimate, percent
  interval: { low: number; high: number }; // 95%, percent
  label: ConfidenceLabel;
  method: "diff_in_diff" | "synthetic_control";
  basis: "measured" | "estimated";
  note: string;
}
```

- [ ] **Step 2: Write the failing ledger test**

```typescript
// tests/unit/causal-ledger.test.ts
import { describe, expect, it } from "vitest";
import { createInMemoryLedger } from "@/lib/causal/ledger";
import type { Intervention } from "@/lib/causal/types";

const sample: Intervention = {
  id: "iv1",
  channel: "google_ads",
  hypothesis: "PMax lifts signups",
  startedAt: "2026-02-01T00:00:00.000Z",
};

describe("createInMemoryLedger", () => {
  it("records and retrieves an intervention", () => {
    const ledger = createInMemoryLedger();
    ledger.record(sample);
    expect(ledger.get("iv1")).toEqual(sample);
    expect(ledger.list()).toHaveLength(1);
  });

  it("seeds from an initial array and overwrites by id", () => {
    const ledger = createInMemoryLedger([sample]);
    ledger.record({ ...sample, hypothesis: "updated" });
    expect(ledger.get("iv1")?.hypothesis).toBe("updated");
    expect(ledger.list()).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/causal-ledger.test.ts`
Expected: FAIL — cannot find module `@/lib/causal/ledger`.

- [ ] **Step 4: Write the ledger implementation**

```typescript
// lib/causal/ledger.ts
import type { Intervention } from "./types";

export interface InterventionLedger {
  record(intervention: Intervention): void;
  list(): Intervention[];
  get(id: string): Intervention | undefined;
}

export function createInMemoryLedger(seed: Intervention[] = []): InterventionLedger {
  const items = new Map<string, Intervention>(seed.map((i) => [i.id, i]));
  return {
    record: (i) => {
      items.set(i.id, i);
    },
    list: () => [...items.values()],
    get: (id) => items.get(id),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/causal-ledger.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/causal/types.ts lib/causal/ledger.ts tests/unit/causal-ledger.test.ts
git commit -m "feat(causal): core types + in-memory intervention ledger"
```

---

### Task 2: Outcome-series helpers + provider contract

**Files:**
- Create: `lib/causal/outcomes.ts`
- Test: `tests/unit/causal-outcomes.test.ts`

**Interfaces:**
- Consumes: `OutcomeSeries`, `OutcomePoint`, `OutcomeUnit` from `@/lib/causal/types`.
- Produces:
  - `interface OutcomeStreamProvider { fetch(scope: { geoScope?: string; unit: OutcomeUnit }, window: { from: string; to: string }): Promise<OutcomeSeries> }`
  - `splitAround(series: OutcomeSeries, startedAt: string): { pre: OutcomePoint[]; post: OutcomePoint[] }`
  - `mean(points: OutcomePoint[]): number`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/causal-outcomes.test.ts
import { describe, expect, it } from "vitest";
import { mean, splitAround } from "@/lib/causal/outcomes";
import type { OutcomeSeries } from "@/lib/causal/types";

const series: OutcomeSeries = {
  unit: "conversions",
  points: [
    { period: "2026-01-01T00:00:00.000Z", value: 10 },
    { period: "2026-01-02T00:00:00.000Z", value: 20 },
    { period: "2026-01-03T00:00:00.000Z", value: 30 },
    { period: "2026-01-04T00:00:00.000Z", value: 40 },
  ],
};

describe("splitAround", () => {
  it("splits strictly before/after the intervention start", () => {
    const { pre, post } = splitAround(series, "2026-01-03T00:00:00.000Z");
    expect(pre.map((p) => p.value)).toEqual([10, 20]);
    expect(post.map((p) => p.value)).toEqual([30, 40]);
  });
});

describe("mean", () => {
  it("averages values", () => {
    expect(mean(series.points)).toBe(25);
  });
  it("returns NaN for empty input", () => {
    expect(Number.isNaN(mean([]))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/causal-outcomes.test.ts`
Expected: FAIL — cannot find module `@/lib/causal/outcomes`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/causal/outcomes.ts
import type { OutcomePoint, OutcomeSeries, OutcomeUnit } from "./types";

export interface OutcomeStreamProvider {
  fetch(
    scope: { geoScope?: string; unit: OutcomeUnit },
    window: { from: string; to: string },
  ): Promise<OutcomeSeries>;
}

/** Split a series into pre/post windows around an intervention start (ISO). */
export function splitAround(
  series: OutcomeSeries,
  startedAt: string,
): { pre: OutcomePoint[]; post: OutcomePoint[] } {
  const t = Date.parse(startedAt);
  const pre: OutcomePoint[] = [];
  const post: OutcomePoint[] = [];
  for (const p of series.points) {
    if (Date.parse(p.period) < t) pre.push(p);
    else post.push(p);
  }
  return { pre, post };
}

export function mean(points: OutcomePoint[]): number {
  if (points.length === 0) return Number.NaN;
  return points.reduce((s, p) => s + p.value, 0) / points.length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/causal-outcomes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/causal/outcomes.ts tests/unit/causal-outcomes.test.ts
git commit -m "feat(causal): outcome-series helpers + provider contract"
```

---

### Task 3: Feasibility / power precheck

**Files:**
- Create: `lib/causal/power.ts`
- Test: `tests/unit/causal-power.test.ts`

**Interfaces:**
- Consumes: `AccountConstraints`, `Feasibility` from `@/lib/causal/types`.
- Produces: `feasibility(constraints: AccountConstraints, windowDays: number): Feasibility`.

Method: for a two-arm rate comparison the relative minimum detectable effect scales as `(zα + zβ) * sqrt(2 / expectedCount)`, where `expectedCount = dailyOutcomeVolume * windowDays`. Uses `zα = 1.96` (two-sided 95%), `zβ = 0.84` (80% power). "Adequately powered" means MDE ≤ 20%.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/causal-power.test.ts
import { describe, expect, it } from "vitest";
import { feasibility } from "@/lib/causal/power";
import type { AccountConstraints } from "@/lib/causal/types";

const base: AccountConstraints = { markets: 2, dailyOutcomeVolume: 100, canPulseBudget: true };

describe("feasibility", () => {
  it("more volume shrinks the minimum detectable effect", () => {
    const low = feasibility({ ...base, dailyOutcomeVolume: 10 }, 21);
    const high = feasibility({ ...base, dailyOutcomeVolume: 1000 }, 21);
    expect(high.minDetectableEffectPct).toBeLessThan(low.minDetectableEffectPct);
  });

  it("flags underpowered when volume is tiny", () => {
    const f = feasibility({ ...base, dailyOutcomeVolume: 1 }, 7);
    expect(f.adequatelyPowered).toBe(false);
  });

  it("flags adequately powered with ample volume", () => {
    const f = feasibility({ ...base, dailyOutcomeVolume: 500 }, 28);
    expect(f.adequatelyPowered).toBe(true);
    expect(f.minDetectableEffectPct).toBeLessThanOrEqual(20);
  });

  it("returns Infinity MDE for zero volume", () => {
    const f = feasibility({ ...base, dailyOutcomeVolume: 0 }, 21);
    expect(f.minDetectableEffectPct).toBe(Number.POSITIVE_INFINITY);
    expect(f.adequatelyPowered).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/causal-power.test.ts`
Expected: FAIL — cannot find module `@/lib/causal/power`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/causal/power.ts
import type { AccountConstraints, Feasibility } from "./types";

const Z_ALPHA = 1.96; // two-sided 95%
const Z_POWER = 0.84; // 80% power
const POWERED_MDE_PCT = 20;

/** Minimum detectable relative effect (percent) for a 2-arm rate test over a window. */
export function feasibility(constraints: AccountConstraints, windowDays: number): Feasibility {
  const expectedCount = constraints.dailyOutcomeVolume * windowDays;
  if (expectedCount <= 0) {
    return {
      minDetectableEffectPct: Number.POSITIVE_INFINITY,
      windowDays,
      adequatelyPowered: false,
      note: "Insufficient volume to detect any effect.",
    };
  }
  const mdePct = (Z_ALPHA + Z_POWER) * Math.sqrt(2 / expectedCount) * 100;
  const rounded = Math.round(mdePct * 10) / 10;
  return {
    minDetectableEffectPct: rounded,
    windowDays,
    adequatelyPowered: rounded <= POWERED_MDE_PCT,
    note: `With ~${constraints.dailyOutcomeVolume}/day over ${windowDays} days, smallest detectable lift ≈ ±${rounded}%.`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/causal-power.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/causal/power.ts tests/unit/causal-power.test.ts
git commit -m "feat(causal): feasibility/power precheck (minimum detectable effect)"
```

---

### Task 4: Synthetic ground-truth generator

**Files:**
- Create: `tests/support/causal-synthetic.ts`
- Test: `tests/unit/causal-synthetic.test.ts`

**Interfaces:**
- Consumes: `OutcomeSeries` from `@/lib/causal/types`.
- Produces:
  - `interface SyntheticSpec { baseline: number; noise: number; preDays: number; postDays: number; trueLiftPct: number; controlDrift?: number; seed?: number }`
  - `generatePair(spec: SyntheticSpec): { treat: OutcomeSeries; control: OutcomeSeries; startedAt: string }`

Deterministic via a `mulberry32` seeded PRNG so tests are reproducible. Both arms share pre-period behaviour; only `treat` gets `trueLiftPct` in the post window; both arms get optional `controlDrift` post (a market-wide trend the estimator must net out).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/causal-synthetic.test.ts
import { describe, expect, it } from "vitest";
import { generatePair } from "@/tests/support/causal-synthetic";

describe("generatePair", () => {
  it("is deterministic for a fixed seed", () => {
    const a = generatePair({ baseline: 100, noise: 0.1, preDays: 14, postDays: 14, trueLiftPct: 20, seed: 7 });
    const b = generatePair({ baseline: 100, noise: 0.1, preDays: 14, postDays: 14, trueLiftPct: 20, seed: 7 });
    expect(a.treat.points).toEqual(b.treat.points);
  });

  it("produces preDays+postDays points per arm and a startedAt at the boundary", () => {
    const { treat, control, startedAt } = generatePair({ baseline: 50, noise: 0, preDays: 10, postDays: 10, trueLiftPct: 0 });
    expect(treat.points).toHaveLength(20);
    expect(control.points).toHaveLength(20);
    expect(Date.parse(startedAt)).toBe(Date.parse(treat.points[10].period));
  });

  it("with zero noise, treat post reflects the true lift over control", () => {
    const { treat, control } = generatePair({ baseline: 100, noise: 0, preDays: 5, postDays: 5, trueLiftPct: 25 });
    expect(treat.points[6].value).toBeCloseTo(control.points[6].value * 1.25, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/causal-synthetic.test.ts`
Expected: FAIL — cannot find module `@/tests/support/causal-synthetic`.

- [ ] **Step 3: Write the implementation**

```typescript
// tests/support/causal-synthetic.ts
import type { OutcomeSeries } from "@/lib/causal/types";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SyntheticSpec {
  baseline: number; // pre-period daily mean for both arms
  noise: number; // fractional jitter amplitude (0 = deterministic)
  preDays: number;
  postDays: number;
  trueLiftPct: number; // applied to treat post only
  controlDrift?: number; // multiplicative post-period trend on both arms
  seed?: number;
}

const DAY_MS = 86_400_000;
const EPOCH = Date.parse("2026-01-01T00:00:00.000Z");

export function generatePair(spec: SyntheticSpec): {
  treat: OutcomeSeries;
  control: OutcomeSeries;
  startedAt: string;
} {
  const rnd = mulberry32(spec.seed ?? 1);
  const drift = spec.controlDrift ?? 1;
  const jitter = () => 1 + (rnd() - 0.5) * 2 * spec.noise;
  const treat: OutcomeSeries = { unit: "conversions", points: [] };
  const control: OutcomeSeries = { unit: "conversions", points: [] };

  let idx = 0;
  for (let d = 0; d < spec.preDays; d++, idx++) {
    const period = new Date(EPOCH + idx * DAY_MS).toISOString();
    treat.points.push({ period, value: spec.baseline * jitter() });
    control.points.push({ period, value: spec.baseline * jitter() });
  }
  const startedAt = new Date(EPOCH + idx * DAY_MS).toISOString();
  for (let d = 0; d < spec.postDays; d++, idx++) {
    const period = new Date(EPOCH + idx * DAY_MS).toISOString();
    treat.points.push({ period, value: spec.baseline * drift * (1 + spec.trueLiftPct / 100) * jitter() });
    control.points.push({ period, value: spec.baseline * drift * jitter() });
  }
  return { treat, control, startedAt };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/causal-synthetic.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/support/causal-synthetic.ts tests/unit/causal-synthetic.test.ts
git commit -m "test(causal): deterministic synthetic ground-truth generator"
```

---

### Task 5: Lift estimator — diff-in-differences

**Files:**
- Create: `lib/causal/estimator.ts`
- Test: `tests/unit/causal-estimator-did.test.ts`

**Interfaces:**
- Consumes: `OutcomeSeries`, `ConfidenceLabel`, `LiftResult` from `@/lib/causal/types`; `splitAround`, `mean` from `@/lib/causal/outcomes`; `generatePair` from `@/tests/support/causal-synthetic` (test only).
- Produces: `diffInDiff(treat: OutcomeSeries, control: OutcomeSeries, startedAt: string, label: ConfidenceLabel): LiftResult`. (Also defines a file-local `stdev` helper reused by Task 6.)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/causal-estimator-did.test.ts
import { describe, expect, it } from "vitest";
import { diffInDiff } from "@/lib/causal/estimator";
import { generatePair } from "@/tests/support/causal-synthetic";

describe("diffInDiff", () => {
  it("recovers a known lift within its confidence interval", () => {
    const { treat, control, startedAt } = generatePair({
      baseline: 200,
      noise: 0.05,
      preDays: 21,
      postDays: 21,
      trueLiftPct: 15,
      seed: 42,
    });
    const r = diffInDiff(treat, control, startedAt, "high_causal");
    expect(r.method).toBe("diff_in_diff");
    expect(r.basis).toBe("measured");
    expect(r.liftPct).toBeGreaterThan(5);
    expect(r.liftPct).toBeLessThan(25);
    expect(r.interval.low).toBeLessThanOrEqual(15);
    expect(r.interval.high).toBeGreaterThanOrEqual(15);
  });

  it("nets out a market-wide drift shared by both arms", () => {
    const { treat, control, startedAt } = generatePair({
      baseline: 200,
      noise: 0,
      preDays: 14,
      postDays: 14,
      trueLiftPct: 10,
      controlDrift: 1.5, // both arms jump 50%; DiD should still report ~10%
    });
    const r = diffInDiff(treat, control, startedAt, "high_causal");
    expect(r.liftPct).toBeCloseTo(10, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/causal-estimator-did.test.ts`
Expected: FAIL — cannot find module `@/lib/causal/estimator`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/causal/estimator.ts
import type { ConfidenceLabel, LiftResult, OutcomeSeries } from "./types";
import { mean, splitAround } from "./outcomes";

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

/** Diff-in-differences lift for a geo-holdout / time-pulse (treat vs control, pre vs post). */
export function diffInDiff(
  treat: OutcomeSeries,
  control: OutcomeSeries,
  startedAt: string,
  label: ConfidenceLabel,
): LiftResult {
  const t = splitAround(treat, startedAt);
  const c = splitAround(control, startedAt);
  const counterfactual = mean(t.pre) + (mean(c.post) - mean(c.pre));
  const actual = mean(t.post);
  const liftPct = ((actual - counterfactual) / counterfactual) * 100;

  const tVar = stdev(t.post.map((p) => p.value)) ** 2 / Math.max(t.post.length, 1);
  const cVar = stdev(c.post.map((p) => p.value)) ** 2 / Math.max(c.post.length, 1);
  const seAbs = Math.sqrt(tVar + cVar);
  const marginPct = ((1.96 * seAbs) / counterfactual) * 100;

  return {
    liftPct: round1(liftPct),
    interval: { low: round1(liftPct - marginPct), high: round1(liftPct + marginPct) },
    label,
    method: "diff_in_diff",
    basis: "measured",
    note: `Diff-in-differences vs matched control over ${t.post.length} post-periods.`,
  };
}

export { stdev, round1 };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/causal-estimator-did.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/causal/estimator.ts tests/unit/causal-estimator-did.test.ts
git commit -m "feat(causal): diff-in-differences lift estimator with honest CI"
```

---

### Task 6: Lift estimator — synthetic-control fallback

**Files:**
- Modify: `lib/causal/estimator.ts`
- Test: `tests/unit/causal-estimator-synth.test.ts`

**Interfaces:**
- Consumes: `stdev`, `round1` (file-local from Task 5); `mean`, `splitAround`; types as before.
- Produces: `syntheticControl(treat: OutcomeSeries, control: OutcomeSeries, startedAt: string): LiftResult` — always labelled `"directional_modeled"` / `basis: "estimated"`.

Method: fit a scale `mean(treatPre)/mean(controlPre)`, project the control post series through it to form the counterfactual, compare to actual treat post. Confidence margin comes from the pre-period fit residuals.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/causal-estimator-synth.test.ts
import { describe, expect, it } from "vitest";
import { syntheticControl } from "@/lib/causal/estimator";
import { generatePair } from "@/tests/support/causal-synthetic";

describe("syntheticControl", () => {
  it("recovers a known lift and is always labelled directional/estimated", () => {
    const { treat, control, startedAt } = generatePair({
      baseline: 300,
      noise: 0.05,
      preDays: 28,
      postDays: 21,
      trueLiftPct: 12,
      seed: 11,
    });
    const r = syntheticControl(treat, control, startedAt);
    expect(r.method).toBe("synthetic_control");
    expect(r.basis).toBe("estimated");
    expect(r.label).toBe("directional_modeled");
    expect(r.liftPct).toBeGreaterThan(4);
    expect(r.liftPct).toBeLessThan(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/causal-estimator-synth.test.ts`
Expected: FAIL — `syntheticControl` is not exported.

- [ ] **Step 3: Add the implementation to `lib/causal/estimator.ts`**

Append to the file (after `diffInDiff`, before the final `export { stdev, round1 }` line — move that export to the very end):

```typescript
/** Synthetic-control counterfactual for when no clean experiment is feasible. */
export function syntheticControl(
  treat: OutcomeSeries,
  control: OutcomeSeries,
  startedAt: string,
): LiftResult {
  const t = splitAround(treat, startedAt);
  const c = splitAround(control, startedAt);
  const scale = mean(t.pre) / mean(c.pre);
  const counterPost = c.post.map((p) => p.value * scale);
  const cfMean = counterPost.reduce((s, v) => s + v, 0) / Math.max(counterPost.length, 1);
  const actual = mean(t.post);
  const liftPct = ((actual - cfMean) / cfMean) * 100;

  const preResiduals = t.pre.map((p, i) => p.value - (c.pre[i]?.value ?? mean(c.pre)) * scale);
  const marginPct = ((1.96 * (stdev(preResiduals) / Math.sqrt(Math.max(t.post.length, 1)))) / cfMean) * 100;

  return {
    liftPct: round1(liftPct),
    interval: { low: round1(liftPct - marginPct), high: round1(liftPct + marginPct) },
    label: "directional_modeled",
    method: "synthetic_control",
    basis: "estimated",
    note: "Modeled counterfactual from control (no clean experiment feasible).",
  };
}
```

- [ ] **Step 4: Run tests to verify both estimator suites pass**

Run: `npx vitest run tests/unit/causal-estimator-did.test.ts tests/unit/causal-estimator-synth.test.ts`
Expected: PASS (3 tests total).

- [ ] **Step 5: Commit**

```bash
git add lib/causal/estimator.ts tests/unit/causal-estimator-synth.test.ts
git commit -m "feat(causal): synthetic-control lift estimator (directional fallback)"
```

---

### Task 7: Truth-Ladder design selector

**Files:**
- Create: `lib/causal/ladder.ts`
- Test: `tests/unit/causal-ladder.test.ts`

**Interfaces:**
- Consumes: `AccountConstraints`, `ExperimentDesign` from `@/lib/causal/types`; `feasibility` from `@/lib/causal/power`.
- Produces: `selectDesign(constraints: AccountConstraints, windowDays?: number): ExperimentDesign` (default `windowDays = 21`).

Ladder logic: multi-market + powered → `geo_holdout`/`high_causal`; single-market but can pulse + powered → `time_pulse`/`good_causal_temporal`; finite MDE but not powered/experimental → `synthetic_control`/`directional_modeled`; otherwise `observational`/`insufficient`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/causal-ladder.test.ts
import { describe, expect, it } from "vitest";
import { selectDesign } from "@/lib/causal/ladder";
import type { AccountConstraints } from "@/lib/causal/types";

const powered: AccountConstraints = { markets: 3, dailyOutcomeVolume: 400, canPulseBudget: true };

describe("selectDesign", () => {
  it("picks geo_holdout when multi-market and adequately powered", () => {
    const d = selectDesign(powered, 21);
    expect(d.rung).toBe("geo_holdout");
    expect(d.label).toBe("high_causal");
  });

  it("picks time_pulse for a single powered market that can pulse budget", () => {
    const d = selectDesign({ ...powered, markets: 1 }, 21);
    expect(d.rung).toBe("time_pulse");
    expect(d.label).toBe("good_causal_temporal");
  });

  it("falls back to synthetic_control when underpowered but some volume exists", () => {
    const d = selectDesign({ markets: 1, dailyOutcomeVolume: 3, canPulseBudget: false }, 21);
    expect(d.rung).toBe("synthetic_control");
    expect(d.label).toBe("directional_modeled");
  });

  it("returns observational/insufficient with no volume", () => {
    const d = selectDesign({ markets: 1, dailyOutcomeVolume: 0, canPulseBudget: false }, 21);
    expect(d.rung).toBe("observational");
    expect(d.label).toBe("insufficient");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/causal-ladder.test.ts`
Expected: FAIL — cannot find module `@/lib/causal/ladder`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/causal/ladder.ts
import type { AccountConstraints, ExperimentDesign } from "./types";
import { feasibility } from "./power";

export function selectDesign(constraints: AccountConstraints, windowDays = 21): ExperimentDesign {
  const feas = feasibility(constraints, windowDays);

  if (constraints.markets >= 2 && feas.adequatelyPowered) {
    return {
      rung: "geo_holdout",
      label: "high_causal",
      minWindowDays: windowDays,
      rationale: "Multiple markets + adequate power → matched treat/control holdout.",
    };
  }
  if (constraints.canPulseBudget && feas.adequatelyPowered) {
    return {
      rung: "time_pulse",
      label: "good_causal_temporal",
      minWindowDays: windowDays,
      rationale: "Single market, but spend can pulse on/off for a temporal test.",
    };
  }
  if (Number.isFinite(feas.minDetectableEffectPct)) {
    return {
      rung: "synthetic_control",
      label: "directional_modeled",
      minWindowDays: windowDays,
      rationale: "No clean experiment feasible; modeled counterfactual only.",
    };
  }
  return {
    rung: "observational",
    label: "insufficient",
    minWindowDays: windowDays,
    rationale: "Insufficient volume for any credible estimate.",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/causal-ladder.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/causal/ladder.ts tests/unit/causal-ladder.test.ts
git commit -m "feat(causal): Truth-Ladder design selector"
```

---

### Task 8: Orchestrator — runCausalTest

**Files:**
- Create: `lib/causal/engine.ts`
- Test: `tests/unit/causal-engine.test.ts`

**Interfaces:**
- Consumes: `Intervention`, `AccountConstraints`, `LiftResult`, `ExperimentDesign`, `Feasibility` from `@/lib/causal/types`; `OutcomeStreamProvider` from `@/lib/causal/outcomes`; `selectDesign`; `feasibility`; `diffInDiff`, `syntheticControl`.
- Produces:
  - `interface CausalReport { intervention: Intervention; design: ExperimentDesign; feasibility: Feasibility; lift: LiftResult | null; honest: string }`
  - `runCausalTest(args: { intervention: Intervention; constraints: AccountConstraints; outcomes: OutcomeStreamProvider; controlScope?: string; windowDays?: number }): Promise<CausalReport>`

Behaviour: choose design; if `observational`, return `lift: null` with an honest "insufficient" message and **no** estimate. Otherwise fetch treat (intervention `geoScope`) and control (`controlScope`) series over `[startedAt − windowDays, endedAt ?? startedAt + windowDays]`, run `diffInDiff` for experimental rungs or `syntheticControl` for the modeled rung.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/causal-engine.test.ts
import { describe, expect, it } from "vitest";
import { runCausalTest } from "@/lib/causal/engine";
import type { OutcomeStreamProvider } from "@/lib/causal/outcomes";
import type { AccountConstraints, Intervention } from "@/lib/causal/types";
import { generatePair } from "@/tests/support/causal-synthetic";

const { treat, control, startedAt } = generatePair({
  baseline: 300,
  noise: 0.05,
  preDays: 21,
  postDays: 21,
  trueLiftPct: 15,
  seed: 5,
});

const intervention: Intervention = {
  id: "iv1",
  channel: "google_ads",
  hypothesis: "PMax lifts conversions",
  startedAt,
  geoScope: "treat",
};

const provider: OutcomeStreamProvider = {
  async fetch(scope) {
    return scope.geoScope === "control" ? control : treat;
  },
};

describe("runCausalTest", () => {
  it("returns a measured DiD lift for a powered multi-market account", async () => {
    const constraints: AccountConstraints = { markets: 3, dailyOutcomeVolume: 400, canPulseBudget: true };
    const report = await runCausalTest({ intervention, constraints, outcomes: provider, controlScope: "control" });
    expect(report.design.rung).toBe("geo_holdout");
    expect(report.lift?.method).toBe("diff_in_diff");
    expect(report.lift?.liftPct).toBeGreaterThan(5);
  });

  it("refuses to declare a winner when observational", async () => {
    const constraints: AccountConstraints = { markets: 1, dailyOutcomeVolume: 0, canPulseBudget: false };
    const report = await runCausalTest({ intervention, constraints, outcomes: provider, controlScope: "control" });
    expect(report.design.rung).toBe("observational");
    expect(report.lift).toBeNull();
    expect(report.honest).toMatch(/insufficient/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/causal-engine.test.ts`
Expected: FAIL — cannot find module `@/lib/causal/engine`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/causal/engine.ts
import type {
  AccountConstraints,
  ExperimentDesign,
  Feasibility,
  Intervention,
  LiftResult,
} from "./types";
import type { OutcomeStreamProvider } from "./outcomes";
import { diffInDiff, syntheticControl } from "./estimator";
import { feasibility } from "./power";
import { selectDesign } from "./ladder";

export interface CausalReport {
  intervention: Intervention;
  design: ExperimentDesign;
  feasibility: Feasibility;
  lift: LiftResult | null;
  honest: string;
}

const DAY_MS = 86_400_000;

function isoShift(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * DAY_MS).toISOString();
}

export async function runCausalTest(args: {
  intervention: Intervention;
  constraints: AccountConstraints;
  outcomes: OutcomeStreamProvider;
  controlScope?: string;
  windowDays?: number;
}): Promise<CausalReport> {
  const windowDays = args.windowDays ?? 21;
  const design = selectDesign(args.constraints, windowDays);
  const feas = feasibility(args.constraints, windowDays);

  if (design.rung === "observational") {
    return {
      intervention: args.intervention,
      design,
      feasibility: feas,
      lift: null,
      honest: "Insufficient — we won't declare a winner without enough signal.",
    };
  }

  const from = isoShift(args.intervention.startedAt, -windowDays);
  const to = args.intervention.endedAt ?? isoShift(args.intervention.startedAt, windowDays);
  const treat = await args.outcomes.fetch({ geoScope: args.intervention.geoScope, unit: "conversions" }, { from, to });
  const control = await args.outcomes.fetch({ geoScope: args.controlScope, unit: "conversions" }, { from, to });

  const lift =
    design.rung === "geo_holdout" || design.rung === "time_pulse" || design.rung === "switchback"
      ? diffInDiff(treat, control, args.intervention.startedAt, design.label)
      : syntheticControl(treat, control, args.intervention.startedAt);

  const honest = `${labelText(lift.label)}: ${lift.liftPct}% lift (95% CI ${lift.interval.low}% to ${lift.interval.high}%).`;
  return { intervention: args.intervention, design, feasibility: feas, lift, honest };
}

function labelText(label: LiftResult["label"]): string {
  switch (label) {
    case "high_causal":
      return "High confidence (causal)";
    case "good_causal_temporal":
      return "Good confidence (causal, temporal)";
    case "directional_modeled":
      return "Directional (modeled)";
    default:
      return "Insufficient";
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/causal-engine.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/causal/engine.ts tests/unit/causal-engine.test.ts
git commit -m "feat(causal): runCausalTest orchestrator with honest readout"
```

---

### Task 9: Demoable API route over fixture data

**Files:**
- Create: `app/api/causal/route.ts`
- Test: `tests/integration/causal-api.test.ts`

**Interfaces:**
- Consumes: `runCausalTest`, `CausalReport` from `@/lib/causal/engine`; `OutcomeStreamProvider` from `@/lib/causal/outcomes`; types from `@/lib/causal/types`; validates input with `zod` (already a dependency).
- Produces: `POST /api/causal` accepting `{ intervention, constraints, treatSeries, controlSeries, windowDays? }` and returning a `CausalReport` as JSON. The body's `treatSeries`/`controlSeries` back an in-request fixture `OutcomeStreamProvider`, so the endpoint runs end-to-end with no external system.

- [ ] **Step 1: Write the failing integration test**

```typescript
// tests/integration/causal-api.test.ts
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/causal/route";
import { generatePair } from "@/tests/support/causal-synthetic";

function req(body: unknown): Request {
  return new Request("http://localhost/api/causal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/causal", () => {
  it("runs end-to-end and returns an honest lift report", async () => {
    const { treat, control, startedAt } = generatePair({
      baseline: 300, noise: 0.05, preDays: 21, postDays: 21, trueLiftPct: 15, seed: 9,
    });
    const res = await POST(
      req({
        intervention: { id: "iv1", channel: "google_ads", hypothesis: "x", startedAt, geoScope: "treat" },
        constraints: { markets: 3, dailyOutcomeVolume: 400, canPulseBudget: true },
        treatSeries: treat,
        controlSeries: control,
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.design.rung).toBe("geo_holdout");
    expect(json.lift.method).toBe("diff_in_diff");
    expect(json.honest).toMatch(/confidence/i);
  });

  it("rejects a malformed body with 400", async () => {
    const res = await POST(req({ nope: true }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/causal-api.test.ts`
Expected: FAIL — cannot find module `@/app/api/causal/route`.

- [ ] **Step 3: Write the implementation**

```typescript
// app/api/causal/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { runCausalTest } from "@/lib/causal/engine";
import type { OutcomeStreamProvider } from "@/lib/causal/outcomes";
import type { OutcomeSeries } from "@/lib/causal/types";

const outcomePoint = z.object({
  period: z.string(),
  value: z.number(),
  n: z.number().optional(),
});
const outcomeSeries = z.object({
  unit: z.enum(["conversions", "revenue", "clicks", "signups"]),
  points: z.array(outcomePoint),
});
const bodySchema = z.object({
  intervention: z.object({
    id: z.string(),
    channel: z.string(),
    hypothesis: z.string(),
    startedAt: z.string(),
    endedAt: z.string().optional(),
    geoScope: z.string().optional(),
    spendDeltaUsd: z.number().optional(),
  }),
  constraints: z.object({
    markets: z.number(),
    dailyOutcomeVolume: z.number(),
    canPulseBudget: z.boolean(),
  }),
  treatSeries: outcomeSeries,
  controlSeries: outcomeSeries,
  windowDays: z.number().optional(),
});

export async function POST(request: Request): Promise<Response> {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const treat = parsed.treatSeries as OutcomeSeries;
  const control = parsed.controlSeries as OutcomeSeries;
  const provider: OutcomeStreamProvider = {
    async fetch(scope) {
      return scope.geoScope === parsed.intervention.geoScope ? treat : control;
    },
  };

  const report = await runCausalTest({
    intervention: parsed.intervention,
    constraints: parsed.constraints,
    outcomes: provider,
    controlScope: "__control__",
    windowDays: parsed.windowDays,
  });
  return NextResponse.json(report);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/causal-api.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full causal suite + typecheck**

Run: `npx vitest run tests/unit/causal-*.test.ts tests/integration/causal-api.test.ts && npm run typecheck`
Expected: All causal tests PASS; typecheck reports no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/causal/route.ts tests/integration/causal-api.test.ts
git commit -m "feat(causal): demoable POST /api/causal over fixture data"
```

---

## Self-Review Notes

- **Spec coverage:** Intervention Ledger (T1), Outcome Streams + provider (T2), Feasibility/power precheck (T3), Truth-Ladder Designer (T7), Lift Estimator DiD + synthetic-control (T5, T6), honest labelling throughout (all tasks), orchestration + demoable path (T8, T9). Deferred per spec: Budget Governor, Google Ads adapter, Learn-loop reweighting, federated benchmarks, switchback rung — each a follow-on plan. `switchback` is accepted as a type value and routed to DiD in the orchestrator, but `selectDesign` never emits it in this slice (documented, not dead).
- **Type consistency:** `OutcomeStreamProvider.fetch` signature, `LiftResult`, `ExperimentDesign`, `Feasibility`, `ConfidenceLabel` values (`high_causal` / `good_causal_temporal` / `directional_modeled` / `insufficient`) and `Rung` values are defined once in `types.ts` and referenced identically in every task.
- **No placeholders:** every step ships runnable code and an exact command.

## Follow-on Plans (next specs → plans)

1. **Budget Governor** — convert measured incremental ROAS/CAC into a human-gated reallocation proposal (never auto-moves money).
2. **Google Ads adapter** — real `OutcomeStreamProvider` + spend-toggle behind the existing provider-contract pattern.
3. **Learn-loop reweighting** — feed measured lifts into the Next-Best-Action ranker (`lib/bandit/`), down-weighting tactics that tested flat.
4. **Dashboard UI** — surface `CausalReport` with rung labels and honest CIs.
