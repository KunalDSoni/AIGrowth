# GIL-01 Per-prompt Citation Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pure `buildCitationLedger(geo)` that turns `GeoResult.observations` into a structured per-prompt citation ledger — separating brand mention from first-party citation, preserving each prompt's cited competitor sources.

**Architecture:** One new pure engine module (`lib/engines/geo-citation-ledger.ts`) plus new types in `lib/analyze/types.ts`. No store, no route, no UI, no network. The builder is a deterministic derivation over the already-persisted `GeoResult`; it is rebuilt on read by later stages. Existing `buildLiveCitationGaps` is left untouched.

**Tech Stack:** TypeScript, Vitest (`vitest run`), `@/` path alias, Next.js app conventions.

## Global Constraints

- Test runner: `npm test` (`vitest run`). Typecheck: `npm run typecheck`. Lint: `npm run lint` (`--max-warnings=0`).
- Import paths use the `@/` alias (e.g. `@/lib/engines/geo-citation-ledger`).
- Unit tests live in `tests/unit/<name>.test.ts` and import from `vitest` (`describe, expect, it`).
- Honesty non-negotiables: unanswered probes excluded from `sampleSize` and all frequencies/rates; a competitor domain counted once per prompt (never per raw citation); `reliable` flag surfaces thin samples, never hides them; builder invents no data and does not mutate its input.
- `MIN_SAMPLE = 3` (matches existing `lib/engines/live-citation-gaps.ts`).
- Builder is pure and deterministic: identical input → identical output.

---

### Task 1: Per-prompt citation ledger builder

**Files:**
- Modify: `lib/analyze/types.ts` (append new types after `GeoResult`, around line 37)
- Create: `lib/engines/geo-citation-ledger.ts`
- Test: `tests/unit/geo-citation-ledger.test.ts`

**Interfaces:**
- Consumes: `GeoResult`, `GeoObservation`, `GeoCitation` from `@/lib/analyze/types` (existing). `GeoCitation = { url: string; domain: string; classification: "first-party" | "other" }`. `GeoObservation = { id: string; prompt: string; rawResponse: string; brandMentioned: boolean; citations: GeoCitation[]; error?: string }`.
- Produces (later stages GIL-02/03/05 rely on these exact names):
  - `type PromptCitationStatus = "cited" | "mentioned-not-cited" | "absent" | "unanswered"`
  - `interface PromptCitationRecord { promptId: string; prompt: string; status: PromptCitationStatus; brandMentioned: boolean; brandCited: boolean; competitorDomains: string[]; citedSources: GeoCitation[] }`
  - `interface CitationLedger { runId: string; model: string; sampleSize: number; records: PromptCitationRecord[]; competitorFrequency: { domain: string; count: number }[]; coverage: { cited: number; mentionedNotCited: number; absent: number; unanswered: number }; reliable: boolean; evidenceIds: string[] }`
  - `function buildCitationLedger(geo: GeoResult, opts?: { evidenceIds?: string[] }): CitationLedger`

- [ ] **Step 1: Add the types**

Append to `lib/analyze/types.ts` after the `GeoResult` interface (currently ends line 37):

```ts
export type PromptCitationStatus =
  | "cited" // first-party citation present for this prompt
  | "mentioned-not-cited" // brand named in text but no first-party citation
  | "absent" // neither mention nor citation
  | "unanswered"; // probe errored or returned empty — excluded from all rates

export interface PromptCitationRecord {
  promptId: string;
  prompt: string;
  status: PromptCitationStatus;
  brandMentioned: boolean;
  brandCited: boolean;
  competitorDomains: string[];
  citedSources: GeoCitation[];
}

export interface CitationLedger {
  runId: string;
  model: string;
  sampleSize: number;
  records: PromptCitationRecord[];
  competitorFrequency: { domain: string; count: number }[];
  coverage: {
    cited: number;
    mentionedNotCited: number;
    absent: number;
    unanswered: number;
  };
  reliable: boolean;
  evidenceIds: string[];
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/geo-citation-ledger.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCitationLedger } from "@/lib/engines/geo-citation-ledger";
import type { GeoCitation, GeoObservation, GeoResult } from "@/lib/analyze/types";

function citation(domain: string, classification: GeoCitation["classification"]): GeoCitation {
  return { url: `https://${domain}/x`, domain, classification };
}

function obs(partial: Partial<GeoObservation> & { id: string; prompt: string }): GeoObservation {
  return {
    rawResponse: "answered",
    brandMentioned: false,
    citations: [],
    ...partial,
  };
}

function geoOf(observations: GeoObservation[]): GeoResult {
  return {
    runId: "run-1",
    model: "fake-model",
    sampleSize: observations.filter((o) => !o.error && o.rawResponse).length,
    brandMentionRate: 0,
    firstPartyCitationShare: 0,
    observations,
    errors: [],
    cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 },
  };
}

describe("buildCitationLedger", () => {
  it("classifies a first-party citation as cited", () => {
    const geo = geoOf([
      obs({ id: "a", prompt: "p1", brandMentioned: true, citations: [citation("brand.com", "first-party")] }),
    ]);
    const ledger = buildCitationLedger(geo);
    expect(ledger.records[0].status).toBe("cited");
    expect(ledger.records[0].brandCited).toBe(true);
  });

  it("classifies a named-but-uncited brand as mentioned-not-cited", () => {
    const geo = geoOf([
      obs({ id: "a", prompt: "p1", brandMentioned: true, citations: [citation("rival.com", "other")] }),
    ]);
    const ledger = buildCitationLedger(geo);
    expect(ledger.records[0].status).toBe("mentioned-not-cited");
    expect(ledger.records[0].brandCited).toBe(false);
  });

  it("classifies neither mention nor citation as absent", () => {
    const geo = geoOf([obs({ id: "a", prompt: "p1", brandMentioned: false, citations: [] })]);
    expect(buildCitationLedger(geo).records[0].status).toBe("absent");
  });

  it("classifies an errored probe as unanswered and excludes it from sampleSize", () => {
    const geo = geoOf([
      obs({ id: "a", prompt: "p1", brandMentioned: true, rawResponse: "", error: "429 quota" }),
      obs({ id: "b", prompt: "p2", brandMentioned: true, citations: [citation("brand.com", "first-party")] }),
    ]);
    const ledger = buildCitationLedger(geo);
    expect(ledger.records[0].status).toBe("unanswered");
    expect(ledger.sampleSize).toBe(1);
  });

  it("dedupes a competitor domain within one prompt", () => {
    const geo = geoOf([
      obs({
        id: "a",
        prompt: "p1",
        citations: [citation("rival.com", "other"), citation("rival.com", "other")],
      }),
    ]);
    const ledger = buildCitationLedger(geo);
    expect(ledger.records[0].competitorDomains).toEqual(["rival.com"]);
    expect(ledger.competitorFrequency).toEqual([{ domain: "rival.com", count: 1 }]);
  });

  it("orders competitorFrequency by count desc then domain asc", () => {
    const geo = geoOf([
      obs({ id: "a", prompt: "p1", citations: [citation("b.com", "other")] }),
      obs({ id: "b", prompt: "p2", citations: [citation("a.com", "other"), citation("b.com", "other")] }),
      obs({ id: "c", prompt: "p3", citations: [citation("a.com", "other")] }),
    ]);
    const ledger = buildCitationLedger(geo);
    expect(ledger.competitorFrequency).toEqual([
      { domain: "a.com", count: 2 },
      { domain: "b.com", count: 2 },
    ]);
  });

  it("coverage counts sum to records.length", () => {
    const geo = geoOf([
      obs({ id: "a", prompt: "p1", brandMentioned: true, citations: [citation("brand.com", "first-party")] }),
      obs({ id: "b", prompt: "p2", brandMentioned: true }),
      obs({ id: "c", prompt: "p3" }),
      obs({ id: "d", prompt: "p4", rawResponse: "", error: "timeout" }),
    ]);
    const ledger = buildCitationLedger(geo);
    const { cited, mentionedNotCited, absent, unanswered } = ledger.coverage;
    expect(cited + mentionedNotCited + absent + unanswered).toBe(ledger.records.length);
    expect(ledger.coverage).toEqual({ cited: 1, mentionedNotCited: 1, absent: 1, unanswered: 1 });
  });

  it("flags reliable only at or above MIN_SAMPLE (3)", () => {
    const two = geoOf([obs({ id: "a", prompt: "p1" }), obs({ id: "b", prompt: "p2" })]);
    const three = geoOf([obs({ id: "a", prompt: "p1" }), obs({ id: "b", prompt: "p2" }), obs({ id: "c", prompt: "p3" })]);
    expect(buildCitationLedger(two).reliable).toBe(false);
    expect(buildCitationLedger(three).reliable).toBe(true);
  });

  it("handles an all-errored geo without throwing", () => {
    const geo = geoOf([
      obs({ id: "a", prompt: "p1", rawResponse: "", error: "429" }),
      obs({ id: "b", prompt: "p2", rawResponse: "", error: "429" }),
    ]);
    const ledger = buildCitationLedger(geo);
    expect(ledger.sampleSize).toBe(0);
    expect(ledger.reliable).toBe(false);
    expect(ledger.records).toHaveLength(2);
  });

  it("passes evidenceIds through and does not mutate input", () => {
    const geo = geoOf([obs({ id: "a", prompt: "p1" })]);
    const snapshot = JSON.stringify(geo);
    const ledger = buildCitationLedger(geo, { evidenceIds: ["ev-1", "ev-2"] });
    expect(ledger.evidenceIds).toEqual(["ev-1", "ev-2"]);
    expect(JSON.stringify(geo)).toBe(snapshot);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- geo-citation-ledger`
Expected: FAIL — `buildCitationLedger` is not exported / module not found.

- [ ] **Step 4: Write the implementation**

Create `lib/engines/geo-citation-ledger.ts`:

```ts
import type {
  CitationLedger,
  GeoResult,
  PromptCitationRecord,
  PromptCitationStatus,
} from "@/lib/analyze/types";

const MIN_SAMPLE = 3;

export function buildCitationLedger(
  geo: GeoResult,
  opts?: { evidenceIds?: string[] },
): CitationLedger {
  const records: PromptCitationRecord[] = geo.observations.map((o) => {
    const unanswered = Boolean(o.error) || !o.rawResponse;
    const brandCited = o.citations.some((c) => c.classification === "first-party");
    const brandMentioned = o.brandMentioned;
    const competitorDomains = [
      ...new Set(o.citations.filter((c) => c.classification === "other").map((c) => c.domain)),
    ];

    let status: PromptCitationStatus;
    if (unanswered) status = "unanswered";
    else if (brandCited) status = "cited";
    else if (brandMentioned) status = "mentioned-not-cited";
    else status = "absent";

    return {
      promptId: o.id,
      prompt: o.prompt,
      status,
      brandMentioned,
      brandCited,
      competitorDomains,
      citedSources: o.citations,
    };
  });

  const answered = records.filter((r) => r.status !== "unanswered");
  const sampleSize = answered.length;

  const freq = new Map<string, number>();
  for (const r of answered) {
    for (const domain of r.competitorDomains) {
      freq.set(domain, (freq.get(domain) ?? 0) + 1);
    }
  }
  const competitorFrequency = [...freq.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));

  const coverage = {
    cited: records.filter((r) => r.status === "cited").length,
    mentionedNotCited: records.filter((r) => r.status === "mentioned-not-cited").length,
    absent: records.filter((r) => r.status === "absent").length,
    unanswered: records.filter((r) => r.status === "unanswered").length,
  };

  return {
    runId: geo.runId,
    model: geo.model,
    sampleSize,
    records,
    competitorFrequency,
    coverage,
    reliable: sampleSize >= MIN_SAMPLE,
    evidenceIds: opts?.evidenceIds ?? [],
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- geo-citation-ledger`
Expected: PASS (11 tests).

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both pass, no errors.

- [ ] **Step 7: Run the full suite (no regressions)**

Run: `npm test`
Expected: all previously-passing tests still pass; the new file adds 11.

- [ ] **Step 8: Commit**

```bash
git add lib/analyze/types.ts lib/engines/geo-citation-ledger.ts tests/unit/geo-citation-ledger.test.ts
git commit -m "feat(geo): per-prompt citation ledger (GIL-01)

Separate brand mention from first-party citation and preserve each
prompt's cited competitor sources — the data spine the GEO Influence
Loop consumes. Pure derivation over GeoResult, no store.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** Every spec section maps to Task 1 — types (Step 1), pure builder + algorithm (Step 4), all honesty rules and every listed test case (Step 2: cited/mentioned-not-cited/absent/unanswered classification, per-prompt dedup, frequency ordering, coverage sum, reliability threshold, all-errored no-throw, purity + evidenceIds passthrough). Out-of-scope items (persistence, route, UI, GIL-02/03/05 concerns, refactoring `buildLiveCitationGaps`) are correctly absent.

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every step shows complete code or an exact command with expected output.

**Type consistency:** `buildCitationLedger`, `CitationLedger`, `PromptCitationRecord`, `PromptCitationStatus`, and field names (`brandCited`, `competitorDomains`, `competitorFrequency`, `citedSources`, `coverage`, `reliable`, `sampleSize`) are identical between the Interfaces block, the types in Step 1, the tests in Step 2, and the implementation in Step 4.
