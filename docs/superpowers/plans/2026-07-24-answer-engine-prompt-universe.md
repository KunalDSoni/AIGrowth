# Answer-Engine Prompt Universe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sample a structured 20–40 prompt buyer-intent universe so the flagship answer-engine mention metric clears n ≥ 20 and reports a real value instead of gating.

**Architecture:** A pure `buildPromptUniverse` generator (no network) becomes `run-geo`'s default prompt source; `run-geo` accepts a structural provider interface so its sampling logic is testable with an injected fake. Sample honesty (`sampleSize = answered.length`) is unchanged.

**Tech Stack:** TypeScript, Vitest. No network in tests — providers are injected.

## Global Constraints

- The sample is the count of prompts actually answered, never the number requested. The metric gates when that count is below threshold, including under API quota limits.
- No bio-style prompts (`isHallucinationPronePrompt` must reject nothing the builder emits); no invented company specifics beyond real `services`/`audiences`.
- `npm test`, `npm run typecheck`, `npm run lint` (`--max-warnings=0`), `npm run build` all pass. Alias `@/` → repo root.

---

### Task 1: buildPromptUniverse

**Files:**
- Create: `lib/engines/prompt-universe.ts`
- Test: `tests/unit/prompt-universe.test.ts`

**Interfaces:**
- Consumes: `isHallucinationPronePrompt` from `@/lib/engines/prompt-derive`
- Produces: `PromptUniverseInput`, `buildPromptUniverse(input): string[]`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/prompt-universe.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPromptUniverse } from "@/lib/engines/prompt-universe";
import { isHallucinationPronePrompt } from "@/lib/engines/prompt-derive";

const base = { brandGuess: "DiligenceOS", domain: "dosacc.com" };

describe("buildPromptUniverse", () => {
  it("produces at least 20 unique prompts for three services", () => {
    const prompts = buildPromptUniverse({ ...base, services: ["bookkeeping", "tax preparation", "payroll"] });
    expect(prompts.length).toBeGreaterThanOrEqual(20);
    expect(new Set(prompts).size).toBe(prompts.length);
    expect(prompts.length).toBeLessThanOrEqual(40);
  });

  it("emits no bio-style prompts", () => {
    const prompts = buildPromptUniverse({ ...base, services: ["bookkeeping", "tax preparation"] });
    for (const p of prompts) expect(isHallucinationPronePrompt(p)).toBe(false);
  });

  it("includes brand-comparison prompts carrying the domain", () => {
    const prompts = buildPromptUniverse({ ...base, services: ["bookkeeping"] });
    expect(prompts.some((p) => p.includes("dosacc.com") && /vs alternatives/i.test(p))).toBe(true);
  });

  it("adds audience-specific prompts when audiences are given", () => {
    const prompts = buildPromptUniverse({
      ...base,
      services: ["bookkeeping"],
      audiences: ["CPA firms"],
    });
    expect(prompts.some((p) => /for CPA firms/i.test(p))).toBe(true);
  });

  it("falls back without throwing when services are empty", () => {
    const prompts = buildPromptUniverse({ ...base, services: [] });
    expect(prompts.length).toBeGreaterThanOrEqual(8);
    expect(prompts.some((p) => /professional services/i.test(p))).toBe(true);
  });

  it("returns at least 8 prompts for a single service", () => {
    expect(buildPromptUniverse({ ...base, services: ["bookkeeping"] }).length).toBeGreaterThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/prompt-universe.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/engines/prompt-universe"`

- [ ] **Step 3: Write the generator**

Create `lib/engines/prompt-universe.ts`:

```ts
/**
 * Structured buyer-intent prompt universe for answer-engine sampling. Generic
 * questions only — never bio prompts, never invented company specifics. Only
 * real services and audiences from the profile are interpolated.
 */

import { isHallucinationPronePrompt } from "@/lib/engines/prompt-derive";

export interface PromptUniverseInput {
  brandGuess: string;
  domain: string;
  services: string[];
  audiences?: string[];
}

const INTENT_TEMPLATES: ((service: string) => string)[] = [
  (s) => `Best ${s} providers`,
  (s) => `Best ${s} companies to hire`,
  (s) => `Top ${s} companies`,
  (s) => `Which company should I hire for ${s}?`,
  (s) => `How do I choose a ${s} provider?`,
  (s) => `What should I look for in a ${s} provider?`,
  (s) => `How much does ${s} cost?`,
  (s) => `Recommended ${s} providers for small businesses`,
];

const MAX_PROMPTS = 40;

export function buildPromptUniverse(input: PromptUniverseInput): string[] {
  const brand = input.brandGuess.trim() || input.domain;
  const domain = input.domain.replace(/^www\./, "");
  const services = (input.services.length ? input.services : ["professional services"]).slice(0, 3);
  const audiences = (input.audiences ?? []).slice(0, 2);

  const prompts: string[] = [];

  for (const service of services) {
    for (const template of INTENT_TEMPLATES) prompts.push(template(service));
    prompts.push(`${brand} (${domain}) vs alternatives for ${service}`);
  }

  for (const service of services.slice(0, 2)) {
    for (const audience of audiences) prompts.push(`Best ${service} providers for ${audience}`);
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const prompt of prompts) {
    const key = prompt.toLowerCase();
    if (seen.has(key) || isHallucinationPronePrompt(prompt)) continue;
    seen.add(key);
    deduped.push(prompt);
  }

  return deduped.slice(0, MAX_PROMPTS);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/prompt-universe.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/engines/prompt-universe.ts tests/unit/prompt-universe.test.ts
git commit -m "feat(geo): structured buyer-intent prompt universe generator"
```

---

### Task 2: Sample the universe in run-geo with an injectable provider

**Files:**
- Modify: `lib/engines/run-geo.ts`
- Test: `tests/unit/run-geo-sampling.test.ts`

**Interfaces:**
- Consumes: `buildPromptUniverse` (Task 1); `geoMentionMetric` from `@/lib/marketing/metrics-view` (test only)
- Produces: `GeoAnswerProvider` interface; `RunGeoInput` gains `audiences?: string[]`; defaults changed

- [ ] **Step 1: Write the failing test**

Create `tests/unit/run-geo-sampling.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runGeoProbes, type GeoAnswerProvider } from "@/lib/engines/run-geo";
import { geoMentionMetric } from "@/lib/marketing/metrics-view";
import { isReliable } from "@/lib/metrics/format";

function provider(behaviour: (prompt: string, i: number) => string | Error): GeoAnswerProvider {
  let i = 0;
  return {
    model: "fake-model",
    async answer(prompt: string) {
      const out = behaviour(prompt, i++);
      if (out instanceof Error) throw out;
      return { rawText: out, usage: { promptTokens: 10, completionTokens: 20 } };
    },
  };
}

const input = {
  brandGuess: "DiligenceOS",
  domain: "dosacc.com",
  services: ["bookkeeping", "tax preparation", "payroll"],
};

describe("run-geo sampling at scale", () => {
  it("samples the full universe and clears the reliable threshold", async () => {
    // Every prompt answered; brand mentioned in half.
    const geo = await runGeoProbes({
      ...input,
      provider: provider((_, i) => (i % 2 === 0 ? "DiligenceOS (dosacc.com) is a strong option." : "Consider other firms.")),
    });
    expect(geo.sampleSize).toBeGreaterThanOrEqual(20);
    const metric = geoMentionMetric({ brandMentionRate: geo.brandMentionRate, sampleSize: geo.sampleSize });
    expect(isReliable(metric)).toBe(true);
  });

  it("counts only answered prompts when a third fail (honest partial sample)", async () => {
    const geo = await runGeoProbes({
      ...input,
      provider: provider((_, i) => (i % 3 === 0 ? new Error("Gemini HTTP 429: quota") : "DiligenceOS is listed.")),
    });
    const requested = geo.observations.length;
    const failed = geo.observations.filter((o) => o.error).length;
    expect(geo.sampleSize).toBe(requested - failed);
    expect(geo.errors.length).toBe(failed);
    expect(failed).toBeGreaterThan(0);
  });

  it("gates when every probe fails (quota exhausted)", async () => {
    const geo = await runGeoProbes({
      ...input,
      provider: provider(() => new Error("Gemini HTTP 429: quota")),
    });
    expect(geo.sampleSize).toBe(0);
    expect(geo.brandMentionRate).toBe(0);
    const metric = geoMentionMetric({ brandMentionRate: 0, sampleSize: 0 });
    expect(isReliable(metric)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/run-geo-sampling.test.ts`
Expected: FAIL — `GeoAnswerProvider` not exported, and `sampleSize` maxes at 6.

- [ ] **Step 3: Rewire run-geo.ts**

In `lib/engines/run-geo.ts`, replace the imports and constants:

```ts
import { buildPromptUniverse } from "@/lib/engines/prompt-universe";
import { extractBrandSignals } from "@/lib/engines/geo-extract";
import type { GeoObservation, GeoResult } from "@/lib/analyze/types";

const TARGET_PROMPTS = 24;
const CONCURRENCY = 4;
const TIMEOUT_MS = 25_000;

/** Structural provider interface so sampling is testable with an injected fake. */
export interface GeoAnswerProvider {
  model: string;
  answer(
    prompt: string,
    opts?: { timeoutMs?: number; retries?: number },
  ): Promise<{ rawText: string; usage?: { promptTokens?: number; completionTokens?: number } }>;
}
```

Change `RunGeoInput` to use the interface and add `audiences`:

```ts
export interface RunGeoInput {
  brandGuess: string;
  domain: string;
  services: string[];
  audiences?: string[];
  provider: GeoAnswerProvider;
  runId?: string;
  maxPrompts?: number;
  /** When set, use these exact prompts instead of buildPromptUniverse. */
  prompts?: string[];
}
```

Change the prompt source and cap in `runGeoProbes`:

```ts
  const prompts = (
    input.prompts ??
    buildPromptUniverse({
      brandGuess: input.brandGuess,
      domain: input.domain,
      services: input.services,
      audiences: input.audiences,
    })
  ).slice(0, input.maxPrompts ?? TARGET_PROMPTS);
```

Everything else (the `mapLimit` loop, error capture, `sampleSize =
answered.length`, mention-rate math) stays as-is.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/run-geo-sampling.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Run the existing geo tests for regressions**

Run: `npx vitest run tests/unit/geo-gemini-next-actions.test.ts tests/unit/geo-mention-metric.test.ts`
Expected: PASS. If a test asserted the old 6-prompt default, update it to the new target.

- [ ] **Step 6: Commit**

```bash
git add lib/engines/run-geo.ts tests/unit/run-geo-sampling.test.ts
git commit -m "feat(geo): sample the prompt universe (target n=24) with an injectable provider"
```

---

### Task 3: Thread the universe through the live analyze path and verify

**Files:**
- Modify: `app/api/analyze/route.ts` (remove dead `deriveGeoPrompts` call; services already flow)
- Modify: `lib/agents/wiring.ts` (Observer probe passes `audiences: []` explicitly)
- Test: none new (covered by Task 2)

**Interfaces:**
- Consumes: the new `run-geo` defaults

- [ ] **Step 1: Remove the dead call in the analyze route**

In `app/api/analyze/route.ts`, delete the line:

```ts
    void deriveGeoPrompts({ brandGuess, domain, services });
```

and remove `deriveGeoPrompts` from that file's imports if it is now unused
(check with `grep -n deriveGeoPrompts app/api/analyze/route.ts`). The subsequent
`runGeoProbes({ brandGuess, domain, services, provider })` call now samples the
24-prompt universe automatically — no change needed there.

- [ ] **Step 2: Make the Observer probe's audience intent explicit**

In `lib/agents/wiring.ts`, in the `probe` function's `runGeoProbes({...})` call,
add `audiences: []` alongside the existing fields, documenting that the
Onboarding agent will supply real audiences later:

```ts
  const result = await runGeoProbes({
    brandGuess: input.brand,
    domain: input.domain,
    services: [],
    audiences: [],
    provider: new GeminiVisibilityProvider(),
  });
```

- [ ] **Step 3: Full verification**

Run:
```bash
rm -rf .data && npm run typecheck && npm run lint && npm test && npm run build
```
Expected: all PASS, zero warnings, `.data/` absent after tests.

- [ ] **Step 4: Commit**

```bash
git add app/api/analyze/route.ts lib/agents/wiring.ts
git commit -m "feat(geo): live analyze samples the prompt universe; drop dead prompt call"
```

---

## What this plan does not cover

- **Durable large-N sampling through the agent runtime** — for universes beyond
  ~24 prompts that exceed a single request's time budget, sampling should move
  to the resumable/budgeted runtime. A later slice.
- **Real quota headroom** — actual `n` on a live scan depends on the API key's
  daily quota; the metric honestly gates when quota is the limiter. Raising
  quota is an ops/config matter, not code.
- **First-party citation-share metric** getting the same interval treatment as
  the mention rate (it already has a `MIN_RELIABLE` entry; wiring a `MetricStat`
  for it is a mechanical follow-up).
