# Synthetic Wind Tunnel — Core Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the offline core that distils real customer evidence into grounded personas, blows messaging variants past them via forced comparative choice, and returns an honestly-labelled SYNTHETIC ranking + objection map — with a calibration hook to the causal engine.

**Architecture:** A new `lib/windtunnel/` module: shared types, a heuristic Persona Distiller (real-data grounded, quote provenance), an injectable `PersonaResponder` contract (deterministic fake for tests; LLM implementation swaps in later, exactly like `AnswerEngineProvider`'s `mock` default), a sampling Runner, a Reaction Aggregator (variant ranking + objection map + segment deltas), a Calibration Tracker, and an orchestrator producing a `WindTunnelReport`. One `POST /api/wind-tunnel` route runs end-to-end over the deterministic responder so it is demoable with no external calls.

**Tech Stack:** TypeScript, Next.js 15 App Router, Vitest, Zod. No new dependencies.

## Global Constraints

- Path alias `@/` maps to repo root. Match existing import style.
- No new npm dependencies.
- Every report is stamped `label: "SYNTHETIC"` and carries a disclaimer; a synthetic reaction is never presented as real customer data. Personas MUST carry `quoteIds` (real-evidence provenance) — a persona with no backing quotes is invalid.
- Thin evidence → fewer/zero personas and `confidence: "insufficient"`; never fabricate a persona from nothing.
- Injectable providers only (like `lib/providers/answer-engine.ts`): the core never calls an LLM directly; tests use a deterministic fake.
- Tests in `tests/unit/` and `tests/integration/`; shared fixtures in `tests/support/`.

## File Structure

- `lib/windtunnel/types.ts` — all shared types (single source of truth).
- `lib/windtunnel/distiller.ts` — `PersonaDistiller` contract + heuristic implementation.
- `lib/windtunnel/responder.ts` — `PersonaResponder` contract.
- `lib/windtunnel/runner.ts` — `runWindTunnel` sampling loop.
- `lib/windtunnel/aggregate.ts` — `rankVariants`, `buildObjectionMap`, `segmentDeltas`.
- `lib/windtunnel/calibration.ts` — `CalibrationTracker`.
- `lib/windtunnel/engine.ts` — `runWindTunnelReport` orchestrator.
- `app/api/wind-tunnel/route.ts` — demoable POST endpoint.
- `tests/support/windtunnel-fixtures.ts` — fixture evidence + deterministic fake responder.
- `tests/unit/windtunnel-*.test.ts`, `tests/integration/windtunnel-api.test.ts`.

**Follow-on plans (out of scope):** LLM-backed `PersonaResponder` + `PersonaDistiller`, review-site/CRM evidence ingestion, landing-page confusion heatmap UI, live calibration wired to Frontier 1 outcomes, multi-language personas.

---

### Task 1: Shared types

**Files:**
- Create: `lib/windtunnel/types.ts`
- Test: `tests/unit/windtunnel-types.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: all types below, plus `SYNTHETIC_DISCLAIMER: string`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/windtunnel-types.test.ts
import { describe, expect, it } from "vitest";
import { SYNTHETIC_DISCLAIMER } from "@/lib/windtunnel/types";

describe("windtunnel types", () => {
  it("exposes a synthetic disclaimer string", () => {
    expect(SYNTHETIC_DISCLAIMER).toMatch(/synthetic/i);
    expect(SYNTHETIC_DISCLAIMER).toMatch(/hypothesis|not.*measurement/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/windtunnel-types.test.ts`
Expected: FAIL — cannot find module `@/lib/windtunnel/types`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/windtunnel/types.ts

export type SegmentId = string;

export interface EvidenceItem {
  id: string;
  source: "review" | "call_note" | "ticket" | "gsc_query" | "won_loss";
  segment?: SegmentId;
  text: string; // verbatim customer voice
  sentiment: "positive" | "negative" | "neutral";
}

export interface Persona {
  id: string;
  segment: SegmentId;
  jobsToBeDone: string[];
  objections: string[]; // extracted objection themes
  vocabulary: string[]; // words the segment actually uses
  quoteIds: string[]; // provenance: EvidenceItem ids backing this persona
}

export interface Variant {
  id: string;
  text: string;
}

export interface Stimulus {
  id: string;
  kind: "headline" | "landing_page";
  variants: Variant[]; // 2+ for comparative choice
}

export interface ForcedChoice {
  winnerVariantId: string;
  reason: string;
  objectionsRaised: string[];
}

export interface PersonaReaction {
  personaId: string;
  segment: SegmentId;
  choices: ForcedChoice[]; // one per sample
}

export interface VariantScore {
  variantId: string;
  wins: number;
  samples: number;
  winShare: number; // 0..1
}

export interface ObjectionMap {
  byPersona: Record<string, string[]>;
  overall: { objection: string; count: number }[];
}

export interface SegmentDelta {
  variantId: string;
  bySegment: Record<SegmentId, number>; // winShare within each segment
}

export interface WindTunnelReport {
  label: "SYNTHETIC";
  disclaimer: string;
  ranking: VariantScore[]; // sorted desc by winShare
  objections: ObjectionMap;
  segmentDeltas: SegmentDelta[];
  personasUsed: number;
  evidenceCount: number;
  confidence: "directional" | "insufficient";
}

export interface CalibrationRecord {
  stimulusId: string;
  predictedWinnerVariantId: string;
  actualWinnerVariantId: string;
}

export const SYNTHETIC_DISCLAIMER =
  "SYNTHETIC — hypothesis, not measurement. Confirm with a real experiment before acting.";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/windtunnel-types.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add lib/windtunnel/types.ts tests/unit/windtunnel-types.test.ts
git commit -m "feat(windtunnel): shared types + synthetic disclaimer"
```

---

### Task 2: Persona Distiller (heuristic, grounded)

**Files:**
- Create: `lib/windtunnel/distiller.ts`
- Test: `tests/unit/windtunnel-distiller.test.ts`

**Interfaces:**
- Consumes: `EvidenceItem`, `Persona`, `SegmentId` from `@/lib/windtunnel/types`.
- Produces:
  - `interface PersonaDistiller { distill(evidence: EvidenceItem[]): Persona[] }`
  - `const MIN_EVIDENCE_PER_PERSONA = 2`
  - `createHeuristicDistiller(): PersonaDistiller`

Rules: group evidence by `segment` (default `"general"`). A group yields a persona only when it has `>= MIN_EVIDENCE_PER_PERSONA` items. `objections` = deduped texts of `negative` items; `jobsToBeDone` = deduped texts of `positive` items; `vocabulary` = lowercased word tokens (length ≥ 4) across the group; `quoteIds` = all item ids (never empty).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/windtunnel-distiller.test.ts
import { describe, expect, it } from "vitest";
import { MIN_EVIDENCE_PER_PERSONA, createHeuristicDistiller } from "@/lib/windtunnel/distiller";
import type { EvidenceItem } from "@/lib/windtunnel/types";

const evidence: EvidenceItem[] = [
  { id: "e1", source: "review", segment: "smb", text: "Setup was too slow and confusing", sentiment: "negative" },
  { id: "e2", source: "call_note", segment: "smb", text: "Loved the fast onboarding once configured", sentiment: "positive" },
  { id: "e3", source: "ticket", segment: "enterprise", text: "Needs SSO and audit logs", sentiment: "negative" },
];

describe("createHeuristicDistiller", () => {
  it("builds one persona per adequately-evidenced segment, with quote provenance", () => {
    const personas = createHeuristicDistiller().distill(evidence);
    const smb = personas.find((p) => p.segment === "smb");
    expect(smb).toBeDefined();
    expect(smb!.quoteIds).toEqual(["e1", "e2"]);
    expect(smb!.objections).toContain("Setup was too slow and confusing");
    expect(smb!.jobsToBeDone).toContain("Loved the fast onboarding once configured");
    expect(smb!.vocabulary).toContain("onboarding");
  });

  it("drops segments below the minimum evidence threshold", () => {
    const personas = createHeuristicDistiller().distill(evidence);
    expect(personas.find((p) => p.segment === "enterprise")).toBeUndefined();
    expect(MIN_EVIDENCE_PER_PERSONA).toBe(2);
  });

  it("returns no personas for empty evidence", () => {
    expect(createHeuristicDistiller().distill([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/windtunnel-distiller.test.ts`
Expected: FAIL — cannot find module `@/lib/windtunnel/distiller`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/windtunnel/distiller.ts
import type { EvidenceItem, Persona, SegmentId } from "./types";

export interface PersonaDistiller {
  distill(evidence: EvidenceItem[]): Persona[];
}

export const MIN_EVIDENCE_PER_PERSONA = 2;

function tokens(texts: string[]): string[] {
  const seen = new Set<string>();
  for (const t of texts) {
    for (const raw of t.toLowerCase().split(/[^a-z]+/)) {
      if (raw.length >= 4) seen.add(raw);
    }
  }
  return [...seen];
}

function unique(xs: string[]): string[] {
  return [...new Set(xs)];
}

export function createHeuristicDistiller(): PersonaDistiller {
  return {
    distill(evidence) {
      const bySegment = new Map<SegmentId, EvidenceItem[]>();
      for (const item of evidence) {
        const seg = item.segment ?? "general";
        const list = bySegment.get(seg) ?? [];
        list.push(item);
        bySegment.set(seg, list);
      }

      const personas: Persona[] = [];
      for (const [segment, items] of bySegment) {
        if (items.length < MIN_EVIDENCE_PER_PERSONA) continue;
        personas.push({
          id: `persona_${segment}`,
          segment,
          objections: unique(items.filter((i) => i.sentiment === "negative").map((i) => i.text)),
          jobsToBeDone: unique(items.filter((i) => i.sentiment === "positive").map((i) => i.text)),
          vocabulary: tokens(items.map((i) => i.text)),
          quoteIds: items.map((i) => i.id),
        });
      }
      return personas;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/windtunnel-distiller.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/windtunnel/distiller.ts tests/unit/windtunnel-distiller.test.ts
git commit -m "feat(windtunnel): heuristic persona distiller with quote provenance"
```

---

### Task 3: PersonaResponder contract + deterministic fake

**Files:**
- Create: `lib/windtunnel/responder.ts`
- Create: `tests/support/windtunnel-fixtures.ts`
- Test: `tests/unit/windtunnel-responder.test.ts`

**Interfaces:**
- Consumes: `Persona`, `Stimulus`, `ForcedChoice` from `@/lib/windtunnel/types`.
- Produces:
  - In `responder.ts`: `interface PersonaResponder { respond(persona: Persona, stimulus: Stimulus, sampleSeed: number): Promise<ForcedChoice> }`
  - In `windtunnel-fixtures.ts`: `createFakeResponder(): PersonaResponder` and `fixtureEvidence: EvidenceItem[]`.

Fake scoring (deterministic): a variant's score = count of the persona's `vocabulary` words appearing (case-insensitive substring) in the variant text. Winner = highest score; ties break by variant array order. `objectionsRaised` = persona objections whose first vocabulary-length token is absent from the winning text. `sampleSeed` is accepted for signature parity but the fake is deterministic.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/windtunnel-responder.test.ts
import { describe, expect, it } from "vitest";
import { createFakeResponder } from "@/tests/support/windtunnel-fixtures";
import type { Persona, Stimulus } from "@/lib/windtunnel/types";

const persona: Persona = {
  id: "persona_smb",
  segment: "smb",
  jobsToBeDone: [],
  objections: ["setup too slow"],
  vocabulary: ["onboarding", "fast", "simple"],
  quoteIds: ["e1", "e2"],
};

const stimulus: Stimulus = {
  id: "s1",
  kind: "headline",
  variants: [
    { id: "v1", text: "Enterprise-grade platform for teams" },
    { id: "v2", text: "Fast, simple onboarding in minutes" },
  ],
};

describe("createFakeResponder", () => {
  it("picks the variant that speaks the persona's vocabulary", async () => {
    const choice = await createFakeResponder().respond(persona, stimulus, 0);
    expect(choice.winnerVariantId).toBe("v2");
    expect(choice.reason).toMatch(/onboarding|fast|simple/i);
  });

  it("is deterministic across seeds", async () => {
    const r = createFakeResponder();
    const a = await r.respond(persona, stimulus, 1);
    const b = await r.respond(persona, stimulus, 99);
    expect(a.winnerVariantId).toBe(b.winnerVariantId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/windtunnel-responder.test.ts`
Expected: FAIL — cannot find module `@/tests/support/windtunnel-fixtures`.

- [ ] **Step 3: Write the responder contract**

```typescript
// lib/windtunnel/responder.ts
import type { ForcedChoice, Persona, Stimulus } from "./types";

export interface PersonaResponder {
  respond(persona: Persona, stimulus: Stimulus, sampleSeed: number): Promise<ForcedChoice>;
}
```

- [ ] **Step 4: Write the fixtures + fake responder**

```typescript
// tests/support/windtunnel-fixtures.ts
import type { PersonaResponder } from "@/lib/windtunnel/responder";
import type { EvidenceItem, ForcedChoice, Persona, Stimulus } from "@/lib/windtunnel/types";

export const fixtureEvidence: EvidenceItem[] = [
  { id: "e1", source: "review", segment: "smb", text: "Setup was too slow and confusing", sentiment: "negative" },
  { id: "e2", source: "call_note", segment: "smb", text: "Fast simple onboarding once configured", sentiment: "positive" },
  { id: "e3", source: "review", segment: "smb", text: "I just want it simple and fast", sentiment: "neutral" },
];

function scoreVariant(text: string, vocabulary: string[]): number {
  const lower = text.toLowerCase();
  return vocabulary.reduce((n, word) => (lower.includes(word) ? n + 1 : n), 0);
}

export function createFakeResponder(): PersonaResponder {
  return {
    async respond(persona: Persona, stimulus: Stimulus, _seed: number): Promise<ForcedChoice> {
      let best = stimulus.variants[0];
      let bestScore = -1;
      for (const v of stimulus.variants) {
        const s = scoreVariant(v.text, persona.vocabulary);
        if (s > bestScore) {
          best = v;
          bestScore = s;
        }
      }
      const matched = persona.vocabulary.filter((w) => best.text.toLowerCase().includes(w));
      const objectionsRaised = persona.objections.filter((o) => {
        const token = o.toLowerCase().split(/\s+/)[0] ?? "";
        return token.length > 0 && !best.text.toLowerCase().includes(token);
      });
      return {
        winnerVariantId: best.id,
        reason: matched.length > 0 ? `Speaks to: ${matched.join(", ")}` : "No strong signal; default choice.",
        objectionsRaised,
      };
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/windtunnel-responder.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/windtunnel/responder.ts tests/support/windtunnel-fixtures.ts tests/unit/windtunnel-responder.test.ts
git commit -m "feat(windtunnel): PersonaResponder contract + deterministic fake"
```

---

### Task 4: Wind Tunnel Runner (sampling)

**Files:**
- Create: `lib/windtunnel/runner.ts`
- Test: `tests/unit/windtunnel-runner.test.ts`

**Interfaces:**
- Consumes: `Persona`, `Stimulus`, `PersonaReaction` from `@/lib/windtunnel/types`; `PersonaResponder` from `@/lib/windtunnel/responder`.
- Produces: `runWindTunnel(args: { personas: Persona[]; stimulus: Stimulus; responder: PersonaResponder; samples?: number }): Promise<PersonaReaction[]>` (default `samples = 3`).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/windtunnel-runner.test.ts
import { describe, expect, it } from "vitest";
import { runWindTunnel } from "@/lib/windtunnel/runner";
import { createFakeResponder } from "@/tests/support/windtunnel-fixtures";
import type { Persona, Stimulus } from "@/lib/windtunnel/types";

const personas: Persona[] = [
  { id: "persona_smb", segment: "smb", jobsToBeDone: [], objections: [], vocabulary: ["fast", "simple"], quoteIds: ["e1"] },
];
const stimulus: Stimulus = {
  id: "s1",
  kind: "headline",
  variants: [
    { id: "v1", text: "Enterprise platform" },
    { id: "v2", text: "Fast simple setup" },
  ],
};

describe("runWindTunnel", () => {
  it("produces one reaction per persona with `samples` choices each", async () => {
    const reactions = await runWindTunnel({ personas, stimulus, responder: createFakeResponder(), samples: 4 });
    expect(reactions).toHaveLength(1);
    expect(reactions[0].personaId).toBe("persona_smb");
    expect(reactions[0].segment).toBe("smb");
    expect(reactions[0].choices).toHaveLength(4);
    expect(reactions[0].choices.every((c) => c.winnerVariantId === "v2")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/windtunnel-runner.test.ts`
Expected: FAIL — cannot find module `@/lib/windtunnel/runner`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/windtunnel/runner.ts
import type { Persona, PersonaReaction, Stimulus } from "./types";
import type { PersonaResponder } from "./responder";

export async function runWindTunnel(args: {
  personas: Persona[];
  stimulus: Stimulus;
  responder: PersonaResponder;
  samples?: number;
}): Promise<PersonaReaction[]> {
  const samples = args.samples ?? 3;
  const reactions: PersonaReaction[] = [];
  for (const persona of args.personas) {
    const choices = [];
    for (let s = 0; s < samples; s++) {
      choices.push(await args.responder.respond(persona, args.stimulus, s));
    }
    reactions.push({ personaId: persona.id, segment: persona.segment, choices });
  }
  return reactions;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/windtunnel-runner.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add lib/windtunnel/runner.ts tests/unit/windtunnel-runner.test.ts
git commit -m "feat(windtunnel): sampling runner over persona panel"
```

---

### Task 5: Reaction Aggregator

**Files:**
- Create: `lib/windtunnel/aggregate.ts`
- Test: `tests/unit/windtunnel-aggregate.test.ts`

**Interfaces:**
- Consumes: `PersonaReaction`, `Stimulus`, `VariantScore`, `ObjectionMap`, `SegmentDelta` from `@/lib/windtunnel/types`.
- Produces:
  - `rankVariants(reactions: PersonaReaction[], stimulus: Stimulus): VariantScore[]` (sorted desc by `winShare`; every variant present, even 0 wins).
  - `buildObjectionMap(reactions: PersonaReaction[]): ObjectionMap`
  - `segmentDeltas(reactions: PersonaReaction[], stimulus: Stimulus): SegmentDelta[]`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/windtunnel-aggregate.test.ts
import { describe, expect, it } from "vitest";
import { buildObjectionMap, rankVariants, segmentDeltas } from "@/lib/windtunnel/aggregate";
import type { PersonaReaction, Stimulus } from "@/lib/windtunnel/types";

const stimulus: Stimulus = {
  id: "s1",
  kind: "headline",
  variants: [
    { id: "v1", text: "A" },
    { id: "v2", text: "B" },
  ],
};

const reactions: PersonaReaction[] = [
  {
    personaId: "p_smb",
    segment: "smb",
    choices: [
      { winnerVariantId: "v2", reason: "", objectionsRaised: ["too slow"] },
      { winnerVariantId: "v2", reason: "", objectionsRaised: ["too slow"] },
    ],
  },
  {
    personaId: "p_ent",
    segment: "enterprise",
    choices: [
      { winnerVariantId: "v1", reason: "", objectionsRaised: ["needs sso"] },
      { winnerVariantId: "v2", reason: "", objectionsRaised: [] },
    ],
  },
];

describe("rankVariants", () => {
  it("ranks by win share and includes every variant", () => {
    const ranking = rankVariants(reactions, stimulus);
    expect(ranking[0].variantId).toBe("v2");
    expect(ranking[0].wins).toBe(3);
    expect(ranking[0].samples).toBe(4);
    expect(ranking[0].winShare).toBeCloseTo(0.75, 5);
    expect(ranking.map((r) => r.variantId).sort()).toEqual(["v1", "v2"]);
  });
});

describe("buildObjectionMap", () => {
  it("dedupes objections per persona and counts overall", () => {
    const map = buildObjectionMap(reactions);
    expect(map.byPersona["p_smb"]).toEqual(["too slow"]);
    expect(map.overall.find((o) => o.objection === "too slow")?.count).toBe(2);
  });
});

describe("segmentDeltas", () => {
  it("reports per-segment win share for each variant", () => {
    const deltas = segmentDeltas(reactions, stimulus);
    const v2 = deltas.find((d) => d.variantId === "v2")!;
    expect(v2.bySegment["smb"]).toBeCloseTo(1, 5);
    expect(v2.bySegment["enterprise"]).toBeCloseTo(0.5, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/windtunnel-aggregate.test.ts`
Expected: FAIL — cannot find module `@/lib/windtunnel/aggregate`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/windtunnel/aggregate.ts
import type { ObjectionMap, PersonaReaction, SegmentDelta, Stimulus, VariantScore } from "./types";

export function rankVariants(reactions: PersonaReaction[], stimulus: Stimulus): VariantScore[] {
  const wins = new Map<string, number>();
  let samples = 0;
  for (const r of reactions) {
    for (const c of r.choices) {
      wins.set(c.winnerVariantId, (wins.get(c.winnerVariantId) ?? 0) + 1);
      samples += 1;
    }
  }
  const scores: VariantScore[] = stimulus.variants.map((v) => {
    const w = wins.get(v.id) ?? 0;
    return { variantId: v.id, wins: w, samples, winShare: samples > 0 ? w / samples : 0 };
  });
  return scores.sort((a, b) => b.winShare - a.winShare);
}

export function buildObjectionMap(reactions: PersonaReaction[]): ObjectionMap {
  const byPersona: Record<string, string[]> = {};
  const counts = new Map<string, number>();
  for (const r of reactions) {
    const set = new Set<string>();
    for (const c of r.choices) {
      for (const o of c.objectionsRaised) {
        set.add(o);
        counts.set(o, (counts.get(o) ?? 0) + 1);
      }
    }
    byPersona[r.personaId] = [...set];
  }
  const overall = [...counts.entries()]
    .map(([objection, count]) => ({ objection, count }))
    .sort((a, b) => b.count - a.count);
  return { byPersona, overall };
}

export function segmentDeltas(reactions: PersonaReaction[], stimulus: Stimulus): SegmentDelta[] {
  return stimulus.variants.map((v) => {
    const bySegment: Record<string, number> = {};
    const segTotals = new Map<string, { wins: number; samples: number }>();
    for (const r of reactions) {
      const agg = segTotals.get(r.segment) ?? { wins: 0, samples: 0 };
      for (const c of r.choices) {
        agg.samples += 1;
        if (c.winnerVariantId === v.id) agg.wins += 1;
      }
      segTotals.set(r.segment, agg);
    }
    for (const [seg, agg] of segTotals) {
      bySegment[seg] = agg.samples > 0 ? agg.wins / agg.samples : 0;
    }
    return { variantId: v.id, bySegment };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/windtunnel-aggregate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/windtunnel/aggregate.ts tests/unit/windtunnel-aggregate.test.ts
git commit -m "feat(windtunnel): reaction aggregator (ranking + objections + segment deltas)"
```

---

### Task 6: Calibration Tracker

**Files:**
- Create: `lib/windtunnel/calibration.ts`
- Test: `tests/unit/windtunnel-calibration.test.ts`

**Interfaces:**
- Consumes: `CalibrationRecord` from `@/lib/windtunnel/types`.
- Produces:
  - `interface CalibrationTracker { record(r: CalibrationRecord): void; hitRate(): { hits: number; total: number; rate: number } }`
  - `createCalibrationTracker(seed?: CalibrationRecord[]): CalibrationTracker`

A "hit" = predicted winner equals actual winner. `rate` is `hits/total`, or `0` when `total === 0`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/windtunnel-calibration.test.ts
import { describe, expect, it } from "vitest";
import { createCalibrationTracker } from "@/lib/windtunnel/calibration";

describe("createCalibrationTracker", () => {
  it("computes hit rate against real outcomes", () => {
    const t = createCalibrationTracker();
    t.record({ stimulusId: "s1", predictedWinnerVariantId: "v2", actualWinnerVariantId: "v2" });
    t.record({ stimulusId: "s2", predictedWinnerVariantId: "v1", actualWinnerVariantId: "v2" });
    expect(t.hitRate()).toEqual({ hits: 1, total: 2, rate: 0.5 });
  });

  it("reports zero rate with no records", () => {
    expect(createCalibrationTracker().hitRate()).toEqual({ hits: 0, total: 0, rate: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/windtunnel-calibration.test.ts`
Expected: FAIL — cannot find module `@/lib/windtunnel/calibration`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/windtunnel/calibration.ts
import type { CalibrationRecord } from "./types";

export interface CalibrationTracker {
  record(r: CalibrationRecord): void;
  hitRate(): { hits: number; total: number; rate: number };
}

export function createCalibrationTracker(seed: CalibrationRecord[] = []): CalibrationTracker {
  const records: CalibrationRecord[] = [...seed];
  return {
    record: (r) => {
      records.push(r);
    },
    hitRate: () => {
      const total = records.length;
      const hits = records.filter((r) => r.predictedWinnerVariantId === r.actualWinnerVariantId).length;
      return { hits, total, rate: total > 0 ? hits / total : 0 };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/windtunnel-calibration.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/windtunnel/calibration.ts tests/unit/windtunnel-calibration.test.ts
git commit -m "feat(windtunnel): calibration tracker (synthetic hit-rate vs real outcomes)"
```

---

### Task 7: Orchestrator — runWindTunnelReport

**Files:**
- Create: `lib/windtunnel/engine.ts`
- Test: `tests/unit/windtunnel-engine.test.ts`

**Interfaces:**
- Consumes: `EvidenceItem`, `Stimulus`, `WindTunnelReport`, `SYNTHETIC_DISCLAIMER` from `@/lib/windtunnel/types`; `PersonaDistiller` from `@/lib/windtunnel/distiller`; `PersonaResponder` from `@/lib/windtunnel/responder`; `runWindTunnel`; `rankVariants`, `buildObjectionMap`, `segmentDeltas`.
- Produces: `runWindTunnelReport(args: { evidence: EvidenceItem[]; stimulus: Stimulus; distiller: PersonaDistiller; responder: PersonaResponder; samples?: number }): Promise<WindTunnelReport>`.

Behaviour: distil personas; when zero personas → `confidence: "insufficient"`, empty ranking/objections/deltas, but STILL `label: "SYNTHETIC"` + disclaimer. Otherwise run + aggregate; `confidence: "directional"`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/windtunnel-engine.test.ts
import { describe, expect, it } from "vitest";
import { runWindTunnelReport } from "@/lib/windtunnel/engine";
import { createHeuristicDistiller } from "@/lib/windtunnel/distiller";
import { createFakeResponder, fixtureEvidence } from "@/tests/support/windtunnel-fixtures";
import type { Stimulus } from "@/lib/windtunnel/types";

const stimulus: Stimulus = {
  id: "s1",
  kind: "headline",
  variants: [
    { id: "v1", text: "Enterprise-grade platform for large teams" },
    { id: "v2", text: "Fast simple onboarding, setup in minutes" },
  ],
};

describe("runWindTunnelReport", () => {
  it("ranks the on-voice variant top and stamps SYNTHETIC", async () => {
    const report = await runWindTunnelReport({
      evidence: fixtureEvidence,
      stimulus,
      distiller: createHeuristicDistiller(),
      responder: createFakeResponder(),
      samples: 3,
    });
    expect(report.label).toBe("SYNTHETIC");
    expect(report.disclaimer).toMatch(/synthetic/i);
    expect(report.ranking[0].variantId).toBe("v2");
    expect(report.confidence).toBe("directional");
    expect(report.personasUsed).toBeGreaterThan(0);
    expect(report.evidenceCount).toBe(fixtureEvidence.length);
  });

  it("returns insufficient (but still SYNTHETIC) when evidence is too thin", async () => {
    const report = await runWindTunnelReport({
      evidence: [{ id: "x", source: "review", segment: "smb", text: "one item", sentiment: "neutral" }],
      stimulus,
      distiller: createHeuristicDistiller(),
      responder: createFakeResponder(),
    });
    expect(report.label).toBe("SYNTHETIC");
    expect(report.confidence).toBe("insufficient");
    expect(report.ranking).toEqual([]);
    expect(report.personasUsed).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/windtunnel-engine.test.ts`
Expected: FAIL — cannot find module `@/lib/windtunnel/engine`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/windtunnel/engine.ts
import type { EvidenceItem, Stimulus, WindTunnelReport } from "./types";
import { SYNTHETIC_DISCLAIMER } from "./types";
import type { PersonaDistiller } from "./distiller";
import type { PersonaResponder } from "./responder";
import { runWindTunnel } from "./runner";
import { buildObjectionMap, rankVariants, segmentDeltas } from "./aggregate";

export async function runWindTunnelReport(args: {
  evidence: EvidenceItem[];
  stimulus: Stimulus;
  distiller: PersonaDistiller;
  responder: PersonaResponder;
  samples?: number;
}): Promise<WindTunnelReport> {
  const personas = args.distiller.distill(args.evidence);

  if (personas.length === 0) {
    return {
      label: "SYNTHETIC",
      disclaimer: SYNTHETIC_DISCLAIMER,
      ranking: [],
      objections: { byPersona: {}, overall: [] },
      segmentDeltas: [],
      personasUsed: 0,
      evidenceCount: args.evidence.length,
      confidence: "insufficient",
    };
  }

  const reactions = await runWindTunnel({
    personas,
    stimulus: args.stimulus,
    responder: args.responder,
    samples: args.samples,
  });

  return {
    label: "SYNTHETIC",
    disclaimer: SYNTHETIC_DISCLAIMER,
    ranking: rankVariants(reactions, args.stimulus),
    objections: buildObjectionMap(reactions),
    segmentDeltas: segmentDeltas(reactions, args.stimulus),
    personasUsed: personas.length,
    evidenceCount: args.evidence.length,
    confidence: "directional",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/windtunnel-engine.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/windtunnel/engine.ts tests/unit/windtunnel-engine.test.ts
git commit -m "feat(windtunnel): orchestrator producing honest SYNTHETIC report"
```

---

### Task 8: Demoable API route

**Files:**
- Create: `app/api/wind-tunnel/route.ts`
- Test: `tests/integration/windtunnel-api.test.ts`

**Interfaces:**
- Consumes: `runWindTunnelReport` from `@/lib/windtunnel/engine`; `createHeuristicDistiller`; `createFakeResponder` from `@/tests/support/windtunnel-fixtures`; validates input with `zod`.
- Produces: `POST /api/wind-tunnel` accepting `{ evidence, stimulus, samples? }`, returning a `WindTunnelReport` JSON. Uses the heuristic distiller + deterministic fake responder so it runs offline (the real LLM responder swaps in later behind the same call).

Note: importing the fake responder from `tests/support` into the route keeps this slice dependency-free and demoable; the follow-on LLM-responder plan replaces that import with a provider selected from config (mirroring `lib/providers/answer-engine.ts`).

- [ ] **Step 1: Write the failing integration test**

```typescript
// tests/integration/windtunnel-api.test.ts
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/wind-tunnel/route";
import { fixtureEvidence } from "@/tests/support/windtunnel-fixtures";

function req(body: unknown): Request {
  return new Request("http://localhost/api/wind-tunnel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/wind-tunnel", () => {
  it("runs end-to-end and returns a SYNTHETIC report", async () => {
    const res = await POST(
      req({
        evidence: fixtureEvidence,
        stimulus: {
          id: "s1",
          kind: "headline",
          variants: [
            { id: "v1", text: "Enterprise-grade platform for large teams" },
            { id: "v2", text: "Fast simple onboarding, setup in minutes" },
          ],
        },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.label).toBe("SYNTHETIC");
    expect(json.ranking[0].variantId).toBe("v2");
  });

  it("rejects a malformed body with 400", async () => {
    const res = await POST(req({ nope: true }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/windtunnel-api.test.ts`
Expected: FAIL — cannot find module `@/app/api/wind-tunnel/route`.

- [ ] **Step 3: Write the implementation**

```typescript
// app/api/wind-tunnel/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHeuristicDistiller } from "@/lib/windtunnel/distiller";
import { runWindTunnelReport } from "@/lib/windtunnel/engine";
import { createFakeResponder } from "@/tests/support/windtunnel-fixtures";

const evidenceItem = z.object({
  id: z.string(),
  source: z.enum(["review", "call_note", "ticket", "gsc_query", "won_loss"]),
  segment: z.string().optional(),
  text: z.string(),
  sentiment: z.enum(["positive", "negative", "neutral"]),
});
const variant = z.object({ id: z.string(), text: z.string() });
const stimulus = z.object({
  id: z.string(),
  kind: z.enum(["headline", "landing_page"]),
  variants: z.array(variant).min(2),
});
const bodySchema = z.object({
  evidence: z.array(evidenceItem),
  stimulus,
  samples: z.number().optional(),
});

export async function POST(request: Request): Promise<Response> {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const report = await runWindTunnelReport({
    evidence: parsed.evidence,
    stimulus: parsed.stimulus,
    distiller: createHeuristicDistiller(),
    responder: createFakeResponder(),
    samples: parsed.samples,
  });
  return NextResponse.json(report);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/windtunnel-api.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full wind-tunnel suite + typecheck**

Run: `npx vitest run tests/unit/windtunnel-*.test.ts tests/integration/windtunnel-api.test.ts && npm run typecheck`
Expected: all wind-tunnel tests PASS; typecheck reports no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/wind-tunnel/route.ts tests/integration/windtunnel-api.test.ts
git commit -m "feat(windtunnel): demoable POST /api/wind-tunnel over fixtures"
```

---

## Self-Review Notes

- **Spec coverage:** Evidence Intake modelled as typed input + heuristic distiller (T2); Persona Distiller with quote provenance (T2); Wind Tunnel Runner with multi-sample + forced comparative choice (T3, T4); Reaction Aggregator + Objection Map + segment deltas (T5); Calibration Tracker (T6); SYNTHETIC labelling everywhere (T1, T7); demoable end-to-end path (T8). Deferred per spec: LLM-backed responder/distiller, review-site ingestion, heatmap UI, live calibration wiring — each a follow-on plan.
- **Type consistency:** `PersonaResponder.respond`, `Persona`, `Stimulus`, `Variant`, `ForcedChoice`, `PersonaReaction`, `VariantScore`, `ObjectionMap`, `SegmentDelta`, `WindTunnelReport`, `CalibrationRecord` are defined once in `types.ts` and referenced identically downstream. `runWindTunnel`, `rankVariants`, `buildObjectionMap`, `segmentDeltas`, `runWindTunnelReport` signatures match across producer and consumer tasks.
- **No placeholders:** every step ships runnable code and an exact command.
- **Honesty guarantee:** the zero-persona branch (T7) still returns `label: "SYNTHETIC"` and never invents personas — thin evidence yields `insufficient`, matching the non-negotiable.

## Follow-on Plans (next)

1. **LLM PersonaResponder + Distiller** — swap the fake for a provider selected from config (mirror `lib/providers/answer-engine.ts`'s `mock`/real pattern); keep the fake as the offline default.
2. **Evidence ingestion** — pull public reviews via the Crawlee/Firecrawl stack; private uploads.
3. **Calibration wiring** — feed Frontier 1 experiment outcomes into `CalibrationTracker` for a live hit-rate.
4. **Wind Tunnel UI** — objection map + landing-page confusion heatmap.
