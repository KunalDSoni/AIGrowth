# Proprietary Research Engine — Core Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the offline core that finds citable research angles, guards methodology/integrity, computes findings with honest confidence intervals, and composes a citable Study (schema.org/Dataset markup) that is never auto-published.

**Architecture:** A new `lib/research/` module: shared types, an Angle Finder (ranks citation-gap questions), a Data Sourcer contract with provenance/license validation, a Methodology Guard (the integrity core — pre-registration + support check that BLOCKS unsupported/unlicensed claims), an Analysis Engine (proportion findings with Wilson CI, reusing `lib/metrics/wilson`), a Study Composer (JSON-LD Dataset markup, human-gated publish), and an orchestrator. One `POST /api/research` route runs end-to-end over fixture data.

**Tech Stack:** TypeScript, Next.js 15 App Router, Vitest, Zod. Reuses `lib/metrics/wilson`. No new dependencies.

## Global Constraints

- Path alias `@/` maps to repo root.
- No new npm dependencies. Reuse `wilsonInterval`/`metricConfidence` from `@/lib/metrics/wilson`.
- Integrity is existential: a fabricated or underpowered statistic must never ship. Unlicensed data → verdict `"unlicensed"`; below the minimum sample → `"insufficient"`; wide interval → `"directional"`; only adequately-powered, licensed data → `"supported"`. The engine refuses to attach a finding it cannot defend.
- Human-gated publish: the engine always emits `publishState: "draft"`. Nothing is auto-published.
- Every finding carries `n`, `source`, and `method`.
- Tests in `tests/unit/` and `tests/integration/`; fixtures in `tests/support/`.

## File Structure

- `lib/research/types.ts` — shared types (single source of truth).
- `lib/research/angles.ts` — `findAngles`.
- `lib/research/sourcer.ts` — `DatasetProvider` contract + `validateProvenance`.
- `lib/research/methodology.ts` — `preRegister` + `checkSupport` (integrity core).
- `lib/research/analysis.ts` — `analyze` (Wilson CI proportion findings).
- `lib/research/composer.ts` — `datasetSchema` + `composeStudy`.
- `lib/research/engine.ts` — `runStudy` orchestrator.
- `app/api/research/route.ts` — demoable POST endpoint.
- `tests/support/research-fixtures.ts` — fixture gaps + dataset + provider.
- `tests/unit/research-*.test.ts`, `tests/integration/research-api.test.ts`.

**Follow-on plans (out of scope):** survey/panel fielding engine, real public-dataset ingestion via the Crawlee/CommonCrawl stack, journalist-outreach sequences, interactive data microsites, non-proportion analyses (means/regression).

---

### Task 1: Shared types

**Files:**
- Create: `lib/research/types.ts`
- Test: `tests/unit/research-types.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: all types below + `INTEGRITY_REFUSAL: string`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/research-types.test.ts
import { describe, expect, it } from "vitest";
import { INTEGRITY_REFUSAL } from "@/lib/research/types";

describe("research types", () => {
  it("exposes an integrity refusal message", () => {
    expect(INTEGRITY_REFUSAL).toMatch(/insufficient|cannot|won't|refuse/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/research-types.test.ts`
Expected: FAIL — cannot find module `@/lib/research/types`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/research/types.ts

export interface CitationGap {
  question: string; // e.g. "What % of freelancers raise rates yearly?"
  topic: string;
  askVolume: number; // how often it is asked (proxy demand)
  existingSources: number; // credible sources already answering (0 = whitespace)
}

export interface StudyAngle {
  id: string;
  question: string;
  topic: string;
  citationPotential: number; // higher = more citable
  rationale: string;
}

export type License = "open" | "public_domain" | "cc_by" | "proprietary_first_party" | "unknown";

export interface DatasetProvenance {
  source: string;
  license: License;
  retrievedAt: string; // ISO
}

export interface Observation {
  matched: boolean; // did this record meet the study criterion?
}

export interface Dataset {
  id: string;
  provenance: DatasetProvenance;
  observations: Observation[];
  population?: string;
  sampleFrame?: string;
}

export interface Methodology {
  question: string;
  metric: string; // what is measured
  method: "proportion"; // v1 supports proportions only
  preRegisteredAt: string; // ISO
  minSampleSize: number;
}

export type SupportVerdict = "supported" | "directional" | "insufficient" | "unlicensed";

export interface MethodologyCheck {
  verdict: SupportVerdict;
  reason: string;
}

export interface StudyFinding {
  question: string;
  headlineStat: string; // "62% of ..."
  value: number; // percent
  interval: { low: number; high: number }; // percent
  n: number;
  source: string;
  method: string;
  confidence: "high" | "medium" | "low" | "insufficient";
}

export type PublishState = "draft" | "approved";

export interface Study {
  angleId: string;
  methodology: Methodology;
  check: MethodologyCheck;
  finding: StudyFinding | null; // null when integrity refuses
  datasetSchema: Record<string, unknown>; // schema.org/Dataset JSON-LD
  publishState: PublishState; // engine always emits "draft"
  integrityNote: string;
}

export const INTEGRITY_REFUSAL =
  "Insufficient / unlicensed data — we won't publish a claim we can't defend.";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/research-types.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add lib/research/types.ts tests/unit/research-types.test.ts
git commit -m "feat(research): shared types + integrity refusal message"
```

---

### Task 2: Angle Finder

**Files:**
- Create: `lib/research/angles.ts`
- Test: `tests/unit/research-angles.test.ts`

**Interfaces:**
- Consumes: `CitationGap`, `StudyAngle` from `@/lib/research/types`.
- Produces: `findAngles(gaps: CitationGap[]): StudyAngle[]` — sorted desc by `citationPotential`, computed as `askVolume / (existingSources + 1)` (high demand + low existing coverage = most citable).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/research-angles.test.ts
import { describe, expect, it } from "vitest";
import { findAngles } from "@/lib/research/angles";
import type { CitationGap } from "@/lib/research/types";

const gaps: CitationGap[] = [
  { question: "Q crowded", topic: "t1", askVolume: 100, existingSources: 9 }, // 10
  { question: "Q whitespace", topic: "t2", askVolume: 80, existingSources: 0 }, // 80
];

describe("findAngles", () => {
  it("ranks high-demand low-coverage questions first", () => {
    const angles = findAngles(gaps);
    expect(angles[0].question).toBe("Q whitespace");
    expect(angles[0].citationPotential).toBe(80);
    expect(angles[1].citationPotential).toBe(10);
  });

  it("returns an empty list for no gaps", () => {
    expect(findAngles([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/research-angles.test.ts`
Expected: FAIL — cannot find module `@/lib/research/angles`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/research/angles.ts
import type { CitationGap, StudyAngle } from "./types";

export function findAngles(gaps: CitationGap[]): StudyAngle[] {
  return gaps
    .map((g, i) => ({
      id: `angle_${i}`,
      question: g.question,
      topic: g.topic,
      citationPotential: g.askVolume / (g.existingSources + 1),
      rationale: `Asked ~${g.askVolume}x with ${g.existingSources} credible source(s) — ${
        g.existingSources === 0 ? "open whitespace" : "under-served"
      }.`,
    }))
    .sort((a, b) => b.citationPotential - a.citationPotential);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/research-angles.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/research/angles.ts tests/unit/research-angles.test.ts
git commit -m "feat(research): angle finder ranks citable whitespace questions"
```

---

### Task 3: Data Sourcer — provenance/license validation

**Files:**
- Create: `lib/research/sourcer.ts`
- Create: `tests/support/research-fixtures.ts`
- Test: `tests/unit/research-sourcer.test.ts`

**Interfaces:**
- Consumes: `Dataset`, `License` from `@/lib/research/types`.
- Produces:
  - In `sourcer.ts`: `interface DatasetProvider { fetch(angleId: string): Promise<Dataset> }` and `validateProvenance(dataset: Dataset): { ok: boolean; reason: string }` (rejects `license: "unknown"`).
  - In `research-fixtures.ts`: `fixtureGaps`, `fixtureDataset(overrides?)`, `createFixtureProvider(dataset)`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/research-sourcer.test.ts
import { describe, expect, it } from "vitest";
import { validateProvenance } from "@/lib/research/sourcer";
import { fixtureDataset } from "@/tests/support/research-fixtures";

describe("validateProvenance", () => {
  it("accepts a licensed dataset", () => {
    expect(validateProvenance(fixtureDataset()).ok).toBe(true);
  });

  it("rejects an unlicensed (unknown) dataset", () => {
    const bad = fixtureDataset({ provenance: { source: "scraped", license: "unknown", retrievedAt: "2026-01-01T00:00:00.000Z" } });
    const res = validateProvenance(bad);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/licens/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/research-sourcer.test.ts`
Expected: FAIL — cannot find module `@/lib/research/sourcer`.

- [ ] **Step 3: Write the sourcer**

```typescript
// lib/research/sourcer.ts
import type { Dataset } from "./types";

export interface DatasetProvider {
  fetch(angleId: string): Promise<Dataset>;
}

export function validateProvenance(dataset: Dataset): { ok: boolean; reason: string } {
  if (dataset.provenance.license === "unknown") {
    return { ok: false, reason: "Dataset license is unknown — excluded from any public claim." };
  }
  if (dataset.observations.length === 0) {
    return { ok: false, reason: "Dataset has no observations." };
  }
  return { ok: true, reason: "Provenance and license verified." };
}
```

- [ ] **Step 4: Write the fixtures**

```typescript
// tests/support/research-fixtures.ts
import type { DatasetProvider } from "@/lib/research/sourcer";
import type { CitationGap, Dataset, Observation } from "@/lib/research/types";

export const fixtureGaps: CitationGap[] = [
  { question: "What % of freelancers raise rates yearly?", topic: "freelancing", askVolume: 90, existingSources: 0 },
  { question: "What % use time-tracking tools?", topic: "freelancing", askVolume: 40, existingSources: 3 },
];

function makeObservations(matched: number, total: number): Observation[] {
  return Array.from({ length: total }, (_, i) => ({ matched: i < matched }));
}

export function fixtureDataset(overrides: Partial<Dataset> = {}): Dataset {
  return {
    id: "ds1",
    provenance: { source: "OpenSurvey 2026", license: "cc_by", retrievedAt: "2026-01-01T00:00:00.000Z" },
    observations: makeObservations(62, 100), // 62%
    population: "freelancers",
    sampleFrame: "OpenSurvey panel",
    ...overrides,
  };
}

export function createFixtureProvider(dataset: Dataset): DatasetProvider {
  return { async fetch() { return dataset; } };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/research-sourcer.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/research/sourcer.ts tests/support/research-fixtures.ts tests/unit/research-sourcer.test.ts
git commit -m "feat(research): dataset provider contract + provenance/license validation"
```

---

### Task 4: Methodology Guard (integrity core)

**Files:**
- Create: `lib/research/methodology.ts`
- Test: `tests/unit/research-methodology.test.ts`

**Interfaces:**
- Consumes: `Dataset`, `Methodology`, `MethodologyCheck` from `@/lib/research/types`; `validateProvenance` from `@/lib/research/sourcer`; `wilsonInterval` from `@/lib/metrics/wilson`.
- Produces:
  - `preRegister(question: string, metric: string, minSampleSize: number, at: string): Methodology`
  - `checkSupport(dataset: Dataset, methodology: Methodology): MethodologyCheck`

`checkSupport` order: unlicensed/invalid provenance → `"unlicensed"`; `n < minSampleSize` → `"insufficient"`; Wilson interval width `> 30` (pp) → `"directional"`; else → `"supported"`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/research-methodology.test.ts
import { describe, expect, it } from "vitest";
import { checkSupport, preRegister } from "@/lib/research/methodology";
import { fixtureDataset } from "@/tests/support/research-fixtures";

const method = preRegister("What % raise rates?", "rate_raisers", 30, "2026-01-01T00:00:00.000Z");

describe("preRegister", () => {
  it("captures the method before results", () => {
    expect(method.method).toBe("proportion");
    expect(method.minSampleSize).toBe(30);
    expect(method.preRegisteredAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("checkSupport", () => {
  it("supports an adequately-powered licensed dataset", () => {
    expect(checkSupport(fixtureDataset(), method).verdict).toBe("supported");
  });

  it("flags unlicensed data before anything else", () => {
    const bad = fixtureDataset({ provenance: { source: "x", license: "unknown", retrievedAt: "2026-01-01T00:00:00.000Z" } });
    expect(checkSupport(bad, method).verdict).toBe("unlicensed");
  });

  it("flags an underpowered dataset as insufficient", () => {
    const small = fixtureDataset({ observations: [{ matched: true }, { matched: false }] });
    expect(checkSupport(small, method).verdict).toBe("insufficient");
  });

  it("flags a wide-interval dataset as directional", () => {
    // n=31 (>= min) but a near-50% split at low n yields a wide interval
    const wide = fixtureDataset({
      observations: Array.from({ length: 31 }, (_, i) => ({ matched: i % 2 === 0 })),
    });
    expect(checkSupport(wide, method).verdict).toBe("directional");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/research-methodology.test.ts`
Expected: FAIL — cannot find module `@/lib/research/methodology`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/research/methodology.ts
import type { Dataset, Methodology, MethodologyCheck } from "./types";
import { validateProvenance } from "./sourcer";
import { wilsonInterval } from "@/lib/metrics/wilson";

const DIRECTIONAL_WIDTH_PP = 30;

export function preRegister(
  question: string,
  metric: string,
  minSampleSize: number,
  at: string,
): Methodology {
  return { question, metric, method: "proportion", preRegisteredAt: at, minSampleSize };
}

export function checkSupport(dataset: Dataset, methodology: Methodology): MethodologyCheck {
  const provenance = validateProvenance(dataset);
  if (!provenance.ok) {
    return { verdict: "unlicensed", reason: provenance.reason };
  }
  const n = dataset.observations.length;
  if (n < methodology.minSampleSize) {
    return { verdict: "insufficient", reason: `n=${n} below minimum ${methodology.minSampleSize}.` };
  }
  const k = dataset.observations.filter((o) => o.matched).length;
  const interval = wilsonInterval(k, n);
  if (!interval) {
    return { verdict: "insufficient", reason: "Interval could not be computed." };
  }
  const width = interval.high - interval.low;
  if (width > DIRECTIONAL_WIDTH_PP) {
    return { verdict: "directional", reason: `Interval width ${width.toFixed(1)}pp — report as directional.` };
  }
  return { verdict: "supported", reason: `n=${n}, interval width ${width.toFixed(1)}pp.` };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/research-methodology.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/research/methodology.ts tests/unit/research-methodology.test.ts
git commit -m "feat(research): methodology guard — blocks unlicensed/underpowered claims"
```

---

### Task 5: Analysis Engine

**Files:**
- Create: `lib/research/analysis.ts`
- Test: `tests/unit/research-analysis.test.ts`

**Interfaces:**
- Consumes: `Dataset`, `Methodology`, `StudyFinding` from `@/lib/research/types`; `wilsonInterval`, `metricConfidence` from `@/lib/metrics/wilson`.
- Produces: `analyze(dataset: Dataset, methodology: Methodology): StudyFinding` — every finding carries `n`, `source`, `method`, Wilson CI, and confidence.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/research-analysis.test.ts
import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/research/analysis";
import { preRegister } from "@/lib/research/methodology";
import { fixtureDataset } from "@/tests/support/research-fixtures";

const method = preRegister("What % raise rates?", "rate_raisers", 30, "2026-01-01T00:00:00.000Z");

describe("analyze", () => {
  it("computes a proportion finding with provenance and CI", () => {
    const f = analyze(fixtureDataset(), method); // 62/100
    expect(f.value).toBeCloseTo(62, 5);
    expect(f.n).toBe(100);
    expect(f.source).toBe("OpenSurvey 2026");
    expect(f.method).toBe("proportion");
    expect(f.headlineStat).toMatch(/62%/);
    expect(f.interval.low).toBeGreaterThan(50);
    expect(f.interval.high).toBeLessThan(75);
    expect(f.confidence).toBe("high");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/research-analysis.test.ts`
Expected: FAIL — cannot find module `@/lib/research/analysis`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/research/analysis.ts
import type { Dataset, Methodology, StudyFinding } from "./types";
import { metricConfidence, wilsonInterval } from "@/lib/metrics/wilson";

export function analyze(dataset: Dataset, methodology: Methodology): StudyFinding {
  const n = dataset.observations.length;
  const k = dataset.observations.filter((o) => o.matched).length;
  const interval = wilsonInterval(k, n) ?? { low: 0, high: 100, method: "wilson" as const };
  const value = n > 0 ? (k / n) * 100 : 0;
  const confidence = metricConfidence(interval, { n, minReliable: methodology.minSampleSize });
  const rounded = Math.round(value);
  return {
    question: methodology.question,
    headlineStat: `${rounded}% — ${methodology.question}`,
    value,
    interval: { low: interval.low, high: interval.high },
    n,
    source: dataset.provenance.source,
    method: methodology.method,
    confidence,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/research-analysis.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add lib/research/analysis.ts tests/unit/research-analysis.test.ts
git commit -m "feat(research): analysis engine — proportion findings with Wilson CI"
```

---

### Task 6: Study Composer

**Files:**
- Create: `lib/research/composer.ts`
- Test: `tests/unit/research-composer.test.ts`

**Interfaces:**
- Consumes: `StudyAngle`, `Methodology`, `MethodologyCheck`, `StudyFinding`, `Study` from `@/lib/research/types`; `INTEGRITY_REFUSAL`.
- Produces:
  - `datasetSchema(finding: StudyFinding): Record<string, unknown>` — schema.org/Dataset JSON-LD.
  - `composeStudy(args: { angle: StudyAngle; methodology: Methodology; check: MethodologyCheck; finding: StudyFinding | null }): Study` — always `publishState: "draft"`; when `check.verdict` is `"unlicensed"` or `"insufficient"`, `finding` is dropped to `null` with the integrity note.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/research-composer.test.ts
import { describe, expect, it } from "vitest";
import { composeStudy, datasetSchema } from "@/lib/research/composer";
import { analyze } from "@/lib/research/analysis";
import { checkSupport, preRegister } from "@/lib/research/methodology";
import { fixtureDataset } from "@/tests/support/research-fixtures";
import type { StudyAngle } from "@/lib/research/types";

const angle: StudyAngle = { id: "angle_0", question: "What % raise rates?", topic: "freelancing", citationPotential: 90, rationale: "x" };
const method = preRegister("What % raise rates?", "rate_raisers", 30, "2026-01-01T00:00:00.000Z");

describe("datasetSchema", () => {
  it("emits schema.org/Dataset JSON-LD", () => {
    const schema = datasetSchema(analyze(fixtureDataset(), method));
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("Dataset");
    expect(schema["variableMeasured"]).toBeDefined();
  });
});

describe("composeStudy", () => {
  it("keeps the finding when supported and stays a draft", () => {
    const dataset = fixtureDataset();
    const check = checkSupport(dataset, method);
    const study = composeStudy({ angle, methodology: method, check, finding: analyze(dataset, method) });
    expect(study.publishState).toBe("draft");
    expect(study.finding).not.toBeNull();
    expect(study.datasetSchema["@type"]).toBe("Dataset");
  });

  it("drops the finding and explains when integrity refuses (unlicensed)", () => {
    const study = composeStudy({
      angle,
      methodology: method,
      check: { verdict: "unlicensed", reason: "no license" },
      finding: analyze(fixtureDataset(), method),
    });
    expect(study.finding).toBeNull();
    expect(study.integrityNote).toMatch(/won't|insufficient|unlicensed/i);
    expect(study.publishState).toBe("draft");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/research-composer.test.ts`
Expected: FAIL — cannot find module `@/lib/research/composer`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/research/composer.ts
import type { MethodologyCheck, Methodology, Study, StudyAngle, StudyFinding } from "./types";
import { INTEGRITY_REFUSAL } from "./types";

export function datasetSchema(finding: StudyFinding): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: finding.question,
    measurementTechnique: finding.method,
    variableMeasured: {
      "@type": "PropertyValue",
      name: finding.question,
      value: finding.value,
      unitText: "percent",
      description: `n=${finding.n}, source=${finding.source}, 95% CI ${finding.interval.low}–${finding.interval.high}%`,
    },
  };
}

export function composeStudy(args: {
  angle: StudyAngle;
  methodology: Methodology;
  check: MethodologyCheck;
  finding: StudyFinding | null;
}): Study {
  const refuses = args.check.verdict === "unlicensed" || args.check.verdict === "insufficient";
  const finding = refuses ? null : args.finding;
  const integrityNote = refuses ? `${INTEGRITY_REFUSAL} (${args.check.reason})` : args.check.reason;
  return {
    angleId: args.angle.id,
    methodology: args.methodology,
    check: args.check,
    finding,
    datasetSchema: finding ? datasetSchema(finding) : {},
    publishState: "draft",
    integrityNote,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/research-composer.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/research/composer.ts tests/unit/research-composer.test.ts
git commit -m "feat(research): study composer — Dataset JSON-LD + human-gated draft"
```

---

### Task 7: Orchestrator — runStudy

**Files:**
- Create: `lib/research/engine.ts`
- Test: `tests/unit/research-engine.test.ts`

**Interfaces:**
- Consumes: `StudyAngle`, `Methodology`, `Study` from `@/lib/research/types`; `DatasetProvider` from `@/lib/research/sourcer`; `checkSupport`; `analyze`; `composeStudy`.
- Produces: `runStudy(args: { angle: StudyAngle; methodology: Methodology; provider: DatasetProvider }): Promise<Study>`.

Behaviour: fetch dataset via provider; run `checkSupport`; compute a finding only when the verdict is `"supported"` or `"directional"`; compose (composer drops it if the verdict later refuses). Always returns a `draft`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/research-engine.test.ts
import { describe, expect, it } from "vitest";
import { runStudy } from "@/lib/research/engine";
import { preRegister } from "@/lib/research/methodology";
import { createFixtureProvider, fixtureDataset } from "@/tests/support/research-fixtures";
import type { StudyAngle } from "@/lib/research/types";

const angle: StudyAngle = { id: "angle_0", question: "What % raise rates?", topic: "freelancing", citationPotential: 90, rationale: "x" };
const method = preRegister("What % raise rates?", "rate_raisers", 30, "2026-01-01T00:00:00.000Z");

describe("runStudy", () => {
  it("produces a supported, citable draft study", async () => {
    const study = await runStudy({ angle, methodology: method, provider: createFixtureProvider(fixtureDataset()) });
    expect(study.check.verdict).toBe("supported");
    expect(study.finding?.headlineStat).toMatch(/62%/);
    expect(study.publishState).toBe("draft");
    expect(study.datasetSchema["@type"]).toBe("Dataset");
  });

  it("refuses to attach a finding for unlicensed data", async () => {
    const bad = fixtureDataset({ provenance: { source: "scraped", license: "unknown", retrievedAt: "2026-01-01T00:00:00.000Z" } });
    const study = await runStudy({ angle, methodology: method, provider: createFixtureProvider(bad) });
    expect(study.check.verdict).toBe("unlicensed");
    expect(study.finding).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/research-engine.test.ts`
Expected: FAIL — cannot find module `@/lib/research/engine`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/research/engine.ts
import type { Methodology, Study, StudyAngle, StudyFinding } from "./types";
import type { DatasetProvider } from "./sourcer";
import { checkSupport } from "./methodology";
import { analyze } from "./analysis";
import { composeStudy } from "./composer";

export async function runStudy(args: {
  angle: StudyAngle;
  methodology: Methodology;
  provider: DatasetProvider;
}): Promise<Study> {
  const dataset = await args.provider.fetch(args.angle.id);
  const check = checkSupport(dataset, args.methodology);
  const canAnalyze = check.verdict === "supported" || check.verdict === "directional";
  const finding: StudyFinding | null = canAnalyze ? analyze(dataset, args.methodology) : null;
  return composeStudy({ angle: args.angle, methodology: args.methodology, check, finding });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/research-engine.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/research/engine.ts tests/unit/research-engine.test.ts
git commit -m "feat(research): runStudy orchestrator (guard → analyze → compose)"
```

---

### Task 8: Demoable API route

**Files:**
- Create: `app/api/research/route.ts`
- Test: `tests/integration/research-api.test.ts`

**Interfaces:**
- Consumes: `findAngles`; `preRegister`; `runStudy`; `createFixtureProvider` from `@/tests/support/research-fixtures`; validates with `zod`.
- Produces: `POST /api/research` accepting `{ gaps, dataset, minSampleSize? }`, returning `{ angles, study }`. Builds a fixture provider from the posted dataset so it runs offline.

- [ ] **Step 1: Write the failing integration test**

```typescript
// tests/integration/research-api.test.ts
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/research/route";
import { fixtureDataset, fixtureGaps } from "@/tests/support/research-fixtures";

function req(body: unknown): Request {
  return new Request("http://localhost/api/research", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/research", () => {
  it("returns ranked angles and a citable draft study", async () => {
    const res = await POST(req({ gaps: fixtureGaps, dataset: fixtureDataset(), minSampleSize: 30 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.angles[0].question).toMatch(/raise rates/i);
    expect(json.study.publishState).toBe("draft");
    expect(json.study.finding.headlineStat).toMatch(/62%/);
  });

  it("rejects a malformed body with 400", async () => {
    const res = await POST(req({ nope: true }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/research-api.test.ts`
Expected: FAIL — cannot find module `@/app/api/research/route`.

- [ ] **Step 3: Write the implementation**

```typescript
// app/api/research/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { findAngles } from "@/lib/research/angles";
import { preRegister } from "@/lib/research/methodology";
import { runStudy } from "@/lib/research/engine";
import { createFixtureProvider } from "@/tests/support/research-fixtures";
import type { Dataset } from "@/lib/research/types";

const gap = z.object({
  question: z.string(),
  topic: z.string(),
  askVolume: z.number(),
  existingSources: z.number(),
});
const observation = z.object({ matched: z.boolean() });
const dataset = z.object({
  id: z.string(),
  provenance: z.object({
    source: z.string(),
    license: z.enum(["open", "public_domain", "cc_by", "proprietary_first_party", "unknown"]),
    retrievedAt: z.string(),
  }),
  observations: z.array(observation),
  population: z.string().optional(),
  sampleFrame: z.string().optional(),
});
const bodySchema = z.object({
  gaps: z.array(gap).min(1),
  dataset,
  minSampleSize: z.number().optional(),
});

export async function POST(request: Request): Promise<Response> {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const angles = findAngles(parsed.gaps);
  const top = angles[0];
  const methodology = preRegister(top.question, "primary_metric", parsed.minSampleSize ?? 30, new Date().toISOString());
  const study = await runStudy({
    angle: top,
    methodology,
    provider: createFixtureProvider(parsed.dataset as Dataset),
  });
  return NextResponse.json({ angles, study });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/research-api.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full research suite + typecheck**

Run: `npx vitest run tests/unit/research-*.test.ts tests/integration/research-api.test.ts && npm run typecheck`
Expected: all research tests PASS; typecheck reports no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/research/route.ts tests/integration/research-api.test.ts
git commit -m "feat(research): demoable POST /api/research over fixtures"
```

---

## Self-Review Notes

- **Spec coverage:** Angle Finder (T2); Data Sourcer + provenance/license (T3); Methodology Guard integrity core (T4); Analysis Engine with n/source/method/CI (T5); Study Composer with schema.org/Dataset + human-gated draft (T6); orchestrator + demoable path (T7, T8). Deferred per spec: survey engine, real ingestion, journalist outreach, microsites, non-proportion analyses.
- **Type consistency:** `CitationGap`, `StudyAngle`, `Dataset`, `Methodology`, `MethodologyCheck`, `SupportVerdict`, `StudyFinding`, `Study`, `License` defined once in `types.ts`; `findAngles`, `validateProvenance`, `checkSupport`, `analyze`, `datasetSchema`, `composeStudy`, `runStudy` signatures consistent producer↔consumer.
- **No placeholders:** every step ships runnable code + exact command.
- **Integrity guarantee:** unlicensed/underpowered data yields `null` finding + refusal note; publish is always `draft`. Matches the existential non-negotiable.

## Follow-on Plans (next)

1. **Real Data Sourcer** — Common Crawl / open-data ingestion behind `DatasetProvider`.
2. **Distribution hook** — feed the Study into Frontier 4 entity work + Outreach CRM pitch.
3. **Survey/panel engine** — field original surveys.
4. **Study microsite UI** — render the citable asset with charts (dataviz standards).
