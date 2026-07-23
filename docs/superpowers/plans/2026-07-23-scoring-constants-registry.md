# Scoring Constants Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put every readiness-scoring constant in one documented registry, rewire the engines to read from it (no value changes), and delete the dead saturating priority function.

**Architecture:** A new `lib/engines/scoring-constants.ts` holds the severity model (penalty + rank + rationale) and readiness bands. `readiness.ts` and `site-audit.ts` read from it instead of their local maps. `calculatePriorityScore` is removed.

**Tech Stack:** TypeScript, Vitest.

## Global Constraints

- No constant value changes. This is a provenance/single-sourcing refactor; behaviour is preserved and tests prove it.
- `SEVERITY` is keyed by the exhaustive `Severity` union — a missing key is a compile error, never a `?? 1` fallback.
- `npm test`, `npm run typecheck`, `npm run lint` (`--max-warnings=0`), `npm run build` all pass. Alias `@/` → repo root.

---

### Task 1: The registry, with consistency tests

**Files:**
- Create: `lib/engines/scoring-constants.ts`
- Test: `tests/unit/scoring-constants.test.ts`

**Interfaces:**
- Consumes: `Severity` from `@/lib/domain/types`, `ReadinessBand` from `@/lib/engines/readiness`
- Produces: `SeverityModel`, `SEVERITY`, `ReadinessBandDef`, `READINESS_BANDS`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/scoring-constants.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { READINESS_BANDS, SEVERITY } from "@/lib/engines/scoring-constants";
import type { Severity } from "@/lib/domain/types";

const order: Severity[] = ["critical", "high", "quick-win", "monitor", "ignore"];

describe("SEVERITY registry", () => {
  it("covers every severity with a rationale", () => {
    for (const s of order) {
      expect(SEVERITY[s]).toBeDefined();
      expect(SEVERITY[s].rationale.length).toBeGreaterThan(10);
    }
  });

  it("has strictly decreasing penalty and rank by severity", () => {
    for (let i = 1; i < order.length; i += 1) {
      expect(SEVERITY[order[i - 1]!].scorePenalty).toBeGreaterThan(SEVERITY[order[i]!].scorePenalty - 1);
      expect(SEVERITY[order[i - 1]!].rank).toBeGreaterThan(SEVERITY[order[i]!].rank);
    }
    expect(SEVERITY.ignore.scorePenalty).toBe(0);
    expect(SEVERITY.ignore.rank).toBe(0);
  });

  it("preserves the existing penalty values", () => {
    expect(SEVERITY.critical.scorePenalty).toBe(15);
    expect(SEVERITY.high.scorePenalty).toBe(6);
    expect(SEVERITY["quick-win"].scorePenalty).toBe(3);
    expect(SEVERITY.monitor.scorePenalty).toBe(1);
  });

  it("preserves the existing rank values", () => {
    expect(SEVERITY.critical.rank).toBe(4);
    expect(SEVERITY.high.rank).toBe(3);
    expect(SEVERITY["quick-win"].rank).toBe(2);
    expect(SEVERITY.monitor.rank).toBe(1);
  });
});

describe("READINESS_BANDS", () => {
  it("is sorted strictly descending by min and ends at 0", () => {
    for (let i = 1; i < READINESS_BANDS.length; i += 1) {
      expect(READINESS_BANDS[i - 1]!.min).toBeGreaterThan(READINESS_BANDS[i]!.min);
    }
    expect(READINESS_BANDS.at(-1)!.min).toBe(0);
  });

  it("names the expected cutoffs", () => {
    expect(READINESS_BANDS.map((b) => b.min)).toEqual([85, 70, 50, 0]);
    expect(READINESS_BANDS.map((b) => b.band)).toEqual(["excellent", "good", "fair", "poor"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/scoring-constants.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/engines/scoring-constants"`

- [ ] **Step 3: Write the registry**

Create `lib/engines/scoring-constants.ts`:

```ts
/**
 * Single documented source of truth for readiness-scoring constants. Every
 * number here carries a written rationale so the product's scores are
 * defensible and tunable in one place.
 */

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
  critical: {
    scorePenalty: 15,
    rank: 4,
    rationale: "Blocks indexing or discovery; a single one materially suppresses visibility.",
  },
  high: {
    scorePenalty: 6,
    rank: 3,
    rationale: "Meaningfully weakens a page's ranking or conversion; several compound.",
  },
  "quick-win": {
    scorePenalty: 3,
    rank: 2,
    rationale: "Low-effort improvement with modest isolated impact.",
  },
  monitor: {
    scorePenalty: 1,
    rank: 1,
    rationale: "Minor; watch but rarely worth dedicated work.",
  },
  ignore: {
    scorePenalty: 0,
    rank: 0,
    rationale: "No action warranted.",
  },
};

export interface ReadinessBandDef {
  min: number;
  band: ReadinessBand;
  rationale: string;
}

/** Ordered high→low; the first whose `min` is met wins. */
export const READINESS_BANDS: ReadinessBandDef[] = [
  { min: 85, band: "excellent", rationale: "At most a few quick-wins remain; the site is discovery-ready." },
  { min: 70, band: "good", rationale: "Fundamentally sound with a handful of high-value fixes outstanding." },
  { min: 50, band: "fair", rationale: "Real gaps present; a focused pass yields visible gains." },
  { min: 0, band: "poor", rationale: "Critical blockers dominate; foundational work needed first." },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/scoring-constants.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/engines/scoring-constants.ts tests/unit/scoring-constants.test.ts
git commit -m "feat(scoring): documented severity + readiness-band registry"
```

---

### Task 2: Rewire readiness.ts and site-audit.ts to the registry

**Files:**
- Modify: `lib/engines/readiness.ts` (remove `PENALTY`, rewire `computeReadiness` + `bandFor`)
- Modify: `lib/engines/site-audit.ts` (remove `SEVERITY_WEIGHT`, rewire `topIssues` sort)
- Test: `tests/unit/scoring-registry-wiring.test.ts`

**Interfaces:**
- Consumes: `SEVERITY`, `READINESS_BANDS` (Task 1)
- Produces: unchanged public signatures for `computeReadiness`, `bandFor`, `aggregateSite`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/scoring-registry-wiring.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bandFor, computeReadiness } from "@/lib/engines/readiness";
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

describe("readiness reads the registry (behaviour preserved)", () => {
  it("subtracts the documented penalties", () => {
    // 1 critical (-15) + 1 high (-6) + 1 quick-win (-3) = 100 - 24 = 76
    expect(computeReadiness([issue("critical", "c"), issue("high", "h"), issue("quick-win", "q")]).score).toBe(76);
  });

  it("bands at the documented cutoffs", () => {
    expect(bandFor(85)).toBe("excellent");
    expect(bandFor(84)).toBe("good");
    expect(bandFor(70)).toBe("good");
    expect(bandFor(69)).toBe("fair");
    expect(bandFor(50)).toBe("fair");
    expect(bandFor(49)).toBe("poor");
    expect(bandFor(0)).toBe("poor");
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `npx vitest run tests/unit/scoring-registry-wiring.test.ts`
Expected: PASS against the current hardcoded values (behaviour is identical). This test is the *behaviour lock* — it must keep passing after the rewire. Proceed to rewire and confirm it still passes.

- [ ] **Step 3: Rewire readiness.ts**

In `lib/engines/readiness.ts`, delete the `PENALTY` constant block (lines ~8–14) and add the import:

```ts
import type { AuditIssue, Severity } from "@/lib/domain/types";
import { READINESS_BANDS, SEVERITY } from "@/lib/engines/scoring-constants";
```

Rewrite `bandFor`:

```ts
export function bandFor(score: number): ReadinessBand {
  return (READINESS_BANDS.find((b) => score >= b.min) ?? READINESS_BANDS[READINESS_BANDS.length - 1]!).band;
}
```

In `computeReadiness`, change the penalty lookup:

```ts
  const penalty = issues.reduce((sum, issue) => sum + (SEVERITY[issue.severity]?.scorePenalty ?? 1), 0);
```

- [ ] **Step 4: Rewire site-audit.ts**

In `lib/engines/site-audit.ts`, delete the `SEVERITY_WEIGHT` constant block (lines ~44–50) and add the import:

```ts
import { SEVERITY } from "@/lib/engines/scoring-constants";
```

Change the `topIssues` sort to use `SEVERITY[...].rank`:

```ts
  const topIssues = [...grouped.values()]
    .sort((a, b) => SEVERITY[b.severity].rank * b.count - SEVERITY[a.severity].rank * a.count)
    .slice(0, 8);
```

- [ ] **Step 5: Run the wiring test and the existing readiness/site-audit tests**

Run: `npx vitest run tests/unit/scoring-registry-wiring.test.ts tests/unit/readiness.test.ts tests/unit/site-audit.test.ts`
Expected: PASS — behaviour unchanged.

- [ ] **Step 6: Commit**

```bash
git add lib/engines/readiness.ts lib/engines/site-audit.ts tests/unit/scoring-registry-wiring.test.ts
git commit -m "refactor(scoring): read severity and bands from the registry (no value change)"
```

---

### Task 3: Delete the dead saturating priority function

**Files:**
- Modify: `lib/engines/priority.ts` (remove `calculatePriorityScore`, `PriorityInputs`)
- Modify: `tests/unit/priority.test.ts` (remove the `calculatePriorityScore` describe block and import)

**Interfaces:**
- Consumes: nothing
- Produces: nothing (removal)

- [ ] **Step 1: Prove it is dead**

Run: `grep -rn "calculatePriorityScore" lib app components | grep -v "priority.ts:"`
Expected: no output (only its own definition). If any consumer prints, STOP and do not delete.

- [ ] **Step 2: Remove from priority.ts**

In `lib/engines/priority.ts`, delete the `PriorityInputs` interface and the `calculatePriorityScore` function (the first ~14 lines after the import). Leave `calculateRecommendationPriority`, `explainRecommendationScore`, `groupRecommendations`, `normalizeAuditIssue`, `opportunityScore`, `rankOpportunities` intact.

- [ ] **Step 3: Remove from the test**

In `tests/unit/priority.test.ts`, remove `calculatePriorityScore` from the import on line 3 and delete the entire `describe("priority scoring", ...)` block (the two `calculatePriorityScore` assertions).

- [ ] **Step 4: Full verification**

Run:
```bash
rm -rf .data && npm run typecheck && npm run lint && npm test && npm run build
```
Expected: all PASS, zero warnings, `.data/` absent after tests.

- [ ] **Step 5: Commit**

```bash
git add lib/engines/priority.ts tests/unit/priority.test.ts
git commit -m "chore(scoring): delete dead saturating calculatePriorityScore"
```

---

## What this plan does not cover

- **Tactic-priority / effort-hour provenance** in `deep-engine.ts` (~15 inline
  numbers). A separate later slice; this registry covers the readiness scoring
  core.
- **#3 Provenance UI** — surfacing the Wilson intervals and confidence from
  sub-project 2 across the dashboards.
