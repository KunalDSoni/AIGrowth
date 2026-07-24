# GIL-ME Multi-Engine Citation Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the GEO Influence Loop's citation ledger across every configured answer engine (Gemini, ChatGPT, Perplexity, Mock), producing per-engine coverage and a cross-engine diagnosis (absent-on-X, competitor union).

**Architecture:** Five focused units that reuse the tested single-engine path: adapters present any `AnswerEngineProvider` as the `GeoAnswerProvider` `runGeoProbes` already consumes; an orchestrator runs the prompt universe per engine; a pure aggregator builds the cross-engine ledger from per-engine `CitationLedger`s (GIL-01); a registry lists measurable engines; a route + page surface it. No change to `run-geo`, `extractBrandSignals`, or `buildCitationLedger`.

**Tech Stack:** TypeScript, Vitest, `@/` alias, Next.js.

## Global Constraints

- Test: `npm test`. Typecheck: `npm run typecheck`. Lint: `npm run lint`.
- Reuse, do not modify: `runGeoProbes`/`GeoAnswerProvider` (`lib/engines/run-geo.ts`), `buildCitationLedger` (`lib/engines/geo-citation-ledger.ts`), `extractBrandSignals` (`lib/engines/geo-extract.ts`), `AnswerEngineProvider`/`AnswerObservation`/`Mock|Perplexity|OpenAIAnswerEngine` (`lib/providers/answer-engine.ts`), `GeminiVisibilityProvider` (`lib/providers/gemini-visibility.ts`).
- Honesty: Mock always `measurement:"simulated"`; "absent on engine X" only when the engine answered (`state:"absent"`), else `unmeasured`; per-engine reliability from its own ledger; a failing engine isolated with `error`, never fabricated; pure functions never mutate inputs.
- Reference interfaces: `GeoAnswerProvider = { model: string; answer(prompt, opts?): Promise<{ rawText: string; usage?: {...} }> }`. `AnswerEngineProvider = { engines: string[]; ask(prompt, opts?: { engine?; market?; brand? }): Promise<AnswerObservation> }`. `AnswerObservation = { prompt; answer; citations: {url;title?;rank?}[]; engine; source; measurement; measuredAt; brandMentioned?; error? }`.

---

### Task 1: Engine adapters (ME-1)

**Files:**
- Create: `lib/engines/geo-engine-adapter.ts`
- Test: `tests/unit/geo-engine-adapter.test.ts`

**Interfaces produced:**
- `answerEngineAsGeoProvider(engine: AnswerEngineProvider, name: string, brand?: string): GeoAnswerProvider`
- `class GeminiAnswerEngine implements AnswerEngineProvider` (ctor `(provider?: { answer(prompt, opts?): Promise<{ rawText: string }> })` defaulting to `new GeminiVisibilityProvider()` lazily; `engines = ["gemini"]`).

- [ ] **Step 1: Write failing test** — `tests/unit/geo-engine-adapter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { answerEngineAsGeoProvider, GeminiAnswerEngine } from "@/lib/engines/geo-engine-adapter";
import type { AnswerEngineProvider, AnswerObservation } from "@/lib/providers/answer-engine";

function engine(obs: (prompt: string) => Partial<AnswerObservation>): AnswerEngineProvider {
  return {
    engines: ["fake"],
    async ask(prompt) {
      return {
        prompt,
        answer: "",
        citations: [],
        engine: "fake",
        source: "fake",
        measurement: "measured",
        measuredAt: "2026-07-24T00:00:00Z",
        ...obs(prompt),
      };
    },
  };
}

describe("answerEngineAsGeoProvider", () => {
  it("folds native citation urls into rawText so extraction classifies them", async () => {
    const provider = answerEngineAsGeoProvider(
      engine(() => ({ answer: "Consider Acme.", citations: [{ url: "https://rival.example/x" }] })),
      "fake",
      "Brand",
    );
    const { rawText } = await provider.answer("p1");
    expect(rawText).toContain("Consider Acme.");
    expect(rawText).toContain("https://rival.example/x");
    expect(provider.model).toBe("fake");
  });

  it("throws when the engine returns an error (so the probe is recorded unanswered)", async () => {
    const provider = answerEngineAsGeoProvider(engine(() => ({ error: "429 quota" })), "fake");
    await expect(provider.answer("p1")).rejects.toThrow(/429/);
  });

  it("wraps a gemini-shaped provider as an AnswerEngineProvider", async () => {
    const gem = new GeminiAnswerEngine({ async answer() { return { rawText: "Brand is listed." }; } });
    expect(gem.engines).toEqual(["gemini"]);
    const obs = await gem.ask("p1", { brand: "Brand" });
    expect(obs.answer).toBe("Brand is listed.");
    expect(obs.engine).toBe("gemini");
    expect(obs.measurement).toBe("measured");
  });
});
```

- [ ] **Step 2: Run — expect fail** (`npm test -- geo-engine-adapter`): module not found.

- [ ] **Step 3: Implement** `lib/engines/geo-engine-adapter.ts`:

```ts
import type { AnswerEngineProvider, AnswerObservation } from "@/lib/providers/answer-engine";
import type { GeoAnswerProvider } from "@/lib/engines/run-geo";
import { GeminiVisibilityProvider } from "@/lib/providers/gemini-visibility";

export function answerEngineAsGeoProvider(
  engine: AnswerEngineProvider,
  name: string,
  brand?: string,
): GeoAnswerProvider {
  return {
    model: name,
    async answer(prompt: string) {
      const obs = await engine.ask(prompt, { brand });
      if (obs.error) throw new Error(obs.error);
      const rawText = [obs.answer, ...obs.citations.map((c) => c.url)].filter(Boolean).join("\n");
      return { rawText };
    },
  };
}

interface GeminiLike {
  answer(prompt: string, opts?: { timeoutMs?: number; retries?: number }): Promise<{ rawText: string }>;
}

export class GeminiAnswerEngine implements AnswerEngineProvider {
  readonly engines = ["gemini"];
  private provider: GeminiLike;
  constructor(provider?: GeminiLike) {
    this.provider = provider ?? new GeminiVisibilityProvider();
  }
  async ask(prompt: string, opts: { brand?: string } = {}): Promise<AnswerObservation> {
    const { rawText } = await this.provider.answer(prompt);
    return {
      prompt,
      answer: rawText,
      citations: [],
      engine: "gemini",
      source: "gemini",
      measurement: "measured",
      measuredAt: new Date().toISOString(),
      brandMentioned: opts.brand ? rawText.toLowerCase().includes(opts.brand.toLowerCase()) : undefined,
    };
  }
}
```

- [ ] **Step 4: Run — expect pass.** **Step 5: typecheck+lint.** **Step 6: Commit** `feat(geo): engine adapters — any answer engine as a GeoAnswerProvider (GIL-ME-1)`.

---

### Task 2: Multi-engine orchestrator (ME-2)

**Files:**
- Create: `lib/engines/geo-multi-engine.ts`
- Test: `tests/unit/geo-multi-engine.test.ts`

**Interfaces produced:**
- `interface EngineSpec { name: string; provider: AnswerEngineProvider; measurement: "measured" | "simulated" | "estimate" }`
- `interface EngineGeoResult { engine: string; measurement: EngineSpec["measurement"]; geo: GeoResult; error?: string }`
- `function runMultiEngineProbes(input: { engines: EngineSpec[]; prompts: string[]; brandGuess: string; domain: string; maxPrompts?: number }): Promise<EngineGeoResult[]>`

**Consumes:** `answerEngineAsGeoProvider` (Task 1), `runGeoProbes` (existing).

- [ ] **Step 1: Write failing test** — `tests/unit/geo-multi-engine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runMultiEngineProbes, type EngineSpec } from "@/lib/engines/geo-multi-engine";
import type { AnswerEngineProvider } from "@/lib/providers/answer-engine";

function eng(name: string, behavior: (p: string) => { answer?: string; url?: string } | Error): AnswerEngineProvider {
  return {
    engines: [name],
    async ask(prompt) {
      const out = behavior(prompt);
      if (out instanceof Error) throw out;
      return {
        prompt,
        answer: out.answer ?? "",
        citations: out.url ? [{ url: out.url }] : [],
        engine: name,
        source: name,
        measurement: "measured",
        measuredAt: "2026-07-24T00:00:00Z",
      };
    },
  };
}

const spec = (name: string, provider: AnswerEngineProvider): EngineSpec => ({ name, provider, measurement: "measured" });

describe("runMultiEngineProbes", () => {
  it("produces one result per engine and isolates a failing engine", async () => {
    const results = await runMultiEngineProbes({
      engines: [
        spec("cites", eng("cites", () => ({ answer: "Brand (brand.invalid) is great.", url: "https://brand.invalid/x" }))),
        spec("absent", eng("absent", () => ({ answer: "Use someone else.", url: "https://rival.example/x" }))),
        spec("broken", eng("broken", () => new Error("engine down"))),
      ],
      prompts: ["p1", "p2", "p3"],
      brandGuess: "Brand",
      domain: "brand.invalid",
    });
    expect(results.map((r) => r.engine)).toEqual(["cites", "absent", "broken"]);
    const broken = results.find((r) => r.engine === "broken")!;
    expect(broken.error).toBeTruthy();
    // broken engine still yields a GeoResult, but every probe failed → sampleSize 0
    expect(broken.geo.sampleSize).toBe(0);
    const cites = results.find((r) => r.engine === "cites")!;
    expect(cites.geo.sampleSize).toBe(3);
  });
});
```

Note: a per-prompt engine error is already handled by `runGeoProbes` (probe recorded failed). `EngineGeoResult.error` is set only when the engine cannot run at all; with `runGeoProbes` catching per-probe, a consistently-throwing engine yields sampleSize 0 and no top-level `error`. The test asserts sampleSize 0 for `broken`; set `error` only on a thrown `runGeoProbes` call (guard below).

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement** `lib/engines/geo-multi-engine.ts`:

```ts
import type { GeoResult } from "@/lib/analyze/types";
import type { AnswerEngineProvider } from "@/lib/providers/answer-engine";
import { runGeoProbes } from "@/lib/engines/run-geo";
import { answerEngineAsGeoProvider } from "@/lib/engines/geo-engine-adapter";

export interface EngineSpec {
  name: string;
  provider: AnswerEngineProvider;
  measurement: "measured" | "simulated" | "estimate";
}

export interface EngineGeoResult {
  engine: string;
  measurement: EngineSpec["measurement"];
  geo: GeoResult;
  error?: string;
}

function emptyGeo(name: string): GeoResult {
  return {
    runId: `geo-${name}-empty`,
    model: name,
    sampleSize: 0,
    brandMentionRate: 0,
    firstPartyCitationShare: 0,
    observations: [],
    errors: [],
    cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 },
  };
}

export async function runMultiEngineProbes(input: {
  engines: EngineSpec[];
  prompts: string[];
  brandGuess: string;
  domain: string;
  maxPrompts?: number;
}): Promise<EngineGeoResult[]> {
  const results: EngineGeoResult[] = [];
  for (const spec of input.engines) {
    try {
      const geo = await runGeoProbes({
        brandGuess: input.brandGuess,
        domain: input.domain,
        services: [],
        provider: answerEngineAsGeoProvider(spec.provider, spec.name, input.brandGuess),
        prompts: input.prompts,
        maxPrompts: input.maxPrompts,
        runId: `geo-${spec.name}-${Date.now()}`,
      });
      results.push({ engine: spec.name, measurement: spec.measurement, geo });
    } catch (error) {
      const message = error instanceof Error ? error.message : "engine failed";
      results.push({ engine: spec.name, measurement: spec.measurement, geo: emptyGeo(spec.name), error: message });
    }
  }
  return results;
}
```

- [ ] **Step 4: Run — expect pass.** **Step 5: typecheck+lint.** **Step 6: Commit** `feat(geo): multi-engine probe orchestrator (GIL-ME-2)`.

---

### Task 3: Cross-engine ledger (ME-3)

**Files:**
- Create: `lib/engines/geo-cross-engine-ledger.ts`
- Test: `tests/unit/geo-cross-engine-ledger.test.ts`

**Interfaces produced** (see spec §ME-3 for the full shapes): `EngineCitationState`, `EngineCitationSummary`, `CrossEngineCompetitor`, `CrossEngineLedger`, `buildCrossEngineLedger(results: EngineGeoResult[]): CrossEngineLedger`.

**Consumes:** `buildCitationLedger` (GIL-01), `EngineGeoResult` (Task 2).

- [ ] **Step 1: Write failing test** — `tests/unit/geo-cross-engine-ledger.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCrossEngineLedger } from "@/lib/engines/geo-cross-engine-ledger";
import type { EngineGeoResult } from "@/lib/engines/geo-multi-engine";
import type { GeoObservation, GeoResult } from "@/lib/analyze/types";

function obs(id: string, cited: boolean, competitor?: string): GeoObservation {
  return {
    id,
    prompt: id,
    rawResponse: "answer",
    brandMentioned: cited,
    citations: [
      ...(cited ? [{ url: "https://brand.invalid/x", domain: "brand.invalid", classification: "first-party" as const }] : []),
      ...(competitor ? [{ url: `https://${competitor}/x`, domain: competitor, classification: "other" as const }] : []),
    ],
  };
}

function geo(observations: GeoObservation[]): GeoResult {
  return {
    runId: "r", model: "m",
    sampleSize: observations.filter((o) => o.rawResponse).length,
    brandMentionRate: 0, firstPartyCitationShare: 0,
    observations, errors: [], cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 },
  };
}

const result = (engine: string, geoResult: GeoResult, error?: string): EngineGeoResult => ({
  engine, measurement: "measured", geo: geoResult, ...(error ? { error } : {}),
});

describe("buildCrossEngineLedger", () => {
  it("assigns covered / absent / unmeasured states per engine", () => {
    const cross = buildCrossEngineLedger([
      result("perplexity", geo([obs("p1", true), obs("p2", true, "a.com")])),
      result("openai", geo([obs("p1", false, "a.com"), obs("p2", false, "b.com")])),
      result("broken", geo([]), "down"),
    ]);
    expect(cross.enginesCovered).toEqual(["perplexity"]);
    expect(cross.enginesAbsent).toEqual(["openai"]);
    expect(cross.enginesUnmeasured).toEqual(["broken"]);
  });

  it("merges the competitor union with per-engine attribution and summed counts", () => {
    const cross = buildCrossEngineLedger([
      result("openai", geo([obs("p1", false, "a.com")])),
      result("perplexity", geo([obs("p1", false, "a.com"), obs("p2", false, "b.com")])),
    ]);
    const a = cross.competitorUnion.find((c) => c.domain === "a.com")!;
    expect(a.engines.sort()).toEqual(["openai", "perplexity"]);
    expect(a.totalCount).toBe(2);
  });

  it("pools cited share across engines and flags reliability", () => {
    const cross = buildCrossEngineLedger([
      result("openai", geo([obs("p1", true), obs("p2", false, "a.com")])),
    ]);
    expect(cross.overallCitedShare).toBe(0.5);
    expect(cross.reliable).toBe(false); // n=2 < 3
  });
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement** `lib/engines/geo-cross-engine-ledger.ts`:

```ts
import { buildCitationLedger } from "@/lib/engines/geo-citation-ledger";
import type { CitationLedger } from "@/lib/analyze/types";
import type { EngineGeoResult } from "@/lib/engines/geo-multi-engine";

export type EngineCitationState = "covered" | "absent" | "unmeasured";

export interface EngineCitationSummary {
  engine: string;
  measurement: EngineGeoResult["measurement"];
  state: EngineCitationState;
  sampleSize: number;
  reliable: boolean;
  citedShare: number;
  coverage: CitationLedger["coverage"];
  topCompetitors: { domain: string; count: number }[];
}

export interface CrossEngineCompetitor {
  domain: string;
  engines: string[];
  totalCount: number;
}

export interface CrossEngineLedger {
  engines: EngineCitationSummary[];
  enginesCovered: string[];
  enginesAbsent: string[];
  enginesUnmeasured: string[];
  competitorUnion: CrossEngineCompetitor[];
  overallCitedShare: number;
  reliable: boolean;
}

export function buildCrossEngineLedger(results: EngineGeoResult[]): CrossEngineLedger {
  const summaries: EngineCitationSummary[] = results.map((r) => {
    const ledger = buildCitationLedger(r.geo);
    const state: EngineCitationState =
      ledger.coverage.cited > 0 ? "covered" : ledger.sampleSize > 0 ? "absent" : "unmeasured";
    const citedShare = ledger.sampleSize
      ? Math.round((ledger.coverage.cited / ledger.sampleSize) * 100) / 100
      : 0;
    return {
      engine: r.engine,
      measurement: r.measurement,
      state,
      sampleSize: ledger.sampleSize,
      reliable: ledger.reliable,
      citedShare,
      coverage: ledger.coverage,
      topCompetitors: ledger.competitorFrequency.slice(0, 5),
    };
  });

  const union = new Map<string, { engines: Set<string>; total: number }>();
  for (const r of results) {
    const ledger = buildCitationLedger(r.geo);
    for (const c of ledger.competitorFrequency) {
      const cur = union.get(c.domain) ?? { engines: new Set<string>(), total: 0 };
      cur.engines.add(r.engine);
      cur.total += c.count;
      union.set(c.domain, cur);
    }
  }
  const competitorUnion = [...union.entries()]
    .map(([domain, v]) => ({ domain, engines: [...v.engines].sort(), totalCount: v.total }))
    .sort((a, b) => b.totalCount - a.totalCount || a.domain.localeCompare(b.domain));

  const pooledAnswered = summaries.reduce((n, s) => n + s.sampleSize, 0);
  const pooledCited = summaries.reduce((n, s) => n + s.coverage.cited, 0);

  return {
    engines: summaries,
    enginesCovered: summaries.filter((s) => s.state === "covered").map((s) => s.engine),
    enginesAbsent: summaries.filter((s) => s.state === "absent").map((s) => s.engine),
    enginesUnmeasured: summaries.filter((s) => s.state === "unmeasured").map((s) => s.engine),
    competitorUnion,
    overallCitedShare: pooledAnswered ? Math.round((pooledCited / pooledAnswered) * 100) / 100 : 0,
    reliable: summaries.some((s) => s.reliable),
  };
}
```

- [ ] **Step 4: Run — expect pass.** **Step 5: typecheck+lint.** **Step 6: Commit** `feat(geo): cross-engine ledger — coverage + absent-on-X + competitor union (GIL-ME-3)`.

---

### Task 4: Engine registry (ME-4)

**Files:**
- Create: `lib/engines/geo-engine-registry.ts`
- Test: `tests/unit/geo-engine-registry.test.ts`

**Interfaces produced:** `getConfiguredEngines(env?: Record<string, string | undefined>): EngineSpec[]`.

**Consumes:** `EngineSpec` (Task 2); `MockAnswerEngineProvider`, `PerplexityAnswerEngine`, `OpenAIAnswerEngine` (existing); `GeminiAnswerEngine` (Task 1).

- [ ] **Step 1: Write failing test** — `tests/unit/geo-engine-registry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getConfiguredEngines } from "@/lib/engines/geo-engine-registry";

describe("getConfiguredEngines", () => {
  it("always includes mock, labelled simulated", () => {
    const engines = getConfiguredEngines({});
    expect(engines.map((e) => e.name)).toEqual(["mock"]);
    expect(engines[0].measurement).toBe("simulated");
  });

  it("adds live engines as their keys appear, labelled measured", () => {
    const engines = getConfiguredEngines({
      PERPLEXITY_API_KEY: "k",
      OPENAI_API_KEY: "k",
      GEMINI_API_KEY: "k",
    });
    const names = engines.map((e) => e.name).sort();
    expect(names).toEqual(["gemini", "mock", "openai", "perplexity"]);
    for (const e of engines.filter((x) => x.name !== "mock")) expect(e.measurement).toBe("measured");
  });
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement** `lib/engines/geo-engine-registry.ts`:

```ts
import {
  MockAnswerEngineProvider,
  OpenAIAnswerEngine,
  PerplexityAnswerEngine,
} from "@/lib/providers/answer-engine";
import { GeminiAnswerEngine } from "@/lib/engines/geo-engine-adapter";
import type { EngineSpec } from "@/lib/engines/geo-multi-engine";

export function getConfiguredEngines(env: Record<string, string | undefined> = process.env): EngineSpec[] {
  const engines: EngineSpec[] = [
    { name: "mock", provider: new MockAnswerEngineProvider(), measurement: "simulated" },
  ];
  if (env.PERPLEXITY_API_KEY) {
    engines.push({ name: "perplexity", provider: new PerplexityAnswerEngine(env.PERPLEXITY_API_KEY), measurement: "measured" });
  }
  if (env.OPENAI_API_KEY) {
    engines.push({ name: "openai", provider: new OpenAIAnswerEngine(env.OPENAI_API_KEY), measurement: "measured" });
  }
  if (env.GEMINI_API_KEY) {
    engines.push({ name: "gemini", provider: new GeminiAnswerEngine(), measurement: "measured" });
  }
  return engines;
}
```

- [ ] **Step 4: Run — expect pass.** **Step 5: typecheck+lint.** **Step 6: Commit** `feat(geo): configured-engine registry (GIL-ME-4)`.

---

### Task 5: Surface — route + page (ME-5)

**Files:**
- Create: `app/api/geo-engines/route.ts`, `app/demo/geo-engines/page.tsx`, `components/cross-engine-ledger.tsx`
- Modify: `components/app-sidebar.tsx` (nav entry + icon)
- Test: `tests/integration/geo-engines-route.test.ts`

**Interfaces consumed:** `getConfiguredEngines`, `runMultiEngineProbes`, `buildCrossEngineLedger`, `getProjectStore`/`domainKey`.

- [ ] **Step 1: Write failing route test** — `tests/integration/geo-engines-route.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GET } from "@/app/api/geo-engines/route";
import { getProjectStore } from "@/lib/projects/store";
import { makeAnalyzeResult } from "../support/analyze-input";

const prevDir = process.env.OPENGROWTH_DATA_DIR;
const prevKeys = {
  p: process.env.PERPLEXITY_API_KEY, o: process.env.OPENAI_API_KEY, g: process.env.GEMINI_API_KEY,
};
beforeAll(() => {
  process.env.OPENGROWTH_DATA_DIR = mkdtempSync(join(tmpdir(), "engines-"));
  delete process.env.PERPLEXITY_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
});
afterAll(() => {
  process.env.OPENGROWTH_DATA_DIR = prevDir;
  if (prevKeys.p) process.env.PERPLEXITY_API_KEY = prevKeys.p;
  if (prevKeys.o) process.env.OPENAI_API_KEY = prevKeys.o;
  if (prevKeys.g) process.env.GEMINI_API_KEY = prevKeys.g;
});

const req = (q = "") => new Request(`http://test.local/api/geo-engines${q}`);

describe("GET /api/geo-engines", () => {
  it("400s without a domain", async () => {
    expect((await GET(req())).status).toBe(400);
  });
  it("409s when the domain was never analysed", async () => {
    expect((await GET(req("?domain=never.invalid"))).status).toBe(409);
  });
  it("returns a mock-only cross-engine ledger for a scanned domain (offline)", async () => {
    const scan = makeAnalyzeResult({ domain: "engines-seed.invalid", geoSampleSize: 3 });
    await getProjectStore().save({
      ...scan,
      geo: { ...scan.geo, observations: scan.geo.observations.map((o, i) => ({ ...o, id: `obs-${i}`, rawResponse: "a", prompt: `Q${i}` })) },
    });
    const res = await GET(req("?domain=engines-seed.invalid"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report.engines.map((e: { engine: string }) => e.engine)).toEqual(["mock"]);
    expect(body.report.engines[0].measurement).toBe("simulated");
  });
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement route** `app/api/geo-engines/route.ts`:

```ts
import { NextResponse } from "next/server";
import { domainKey, getProjectStore } from "@/lib/projects/store";
import { getConfiguredEngines } from "@/lib/engines/geo-engine-registry";
import { runMultiEngineProbes } from "@/lib/engines/geo-multi-engine";
import { buildCrossEngineLedger } from "@/lib/engines/geo-cross-engine-ledger";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain");
  if (!domain) return NextResponse.json({ error: "A domain is required.", report: null }, { status: 400 });

  const latest = await getProjectStore().loadLatest(domainKey(domain));
  if (!latest) {
    return NextResponse.json({ error: `No analysis for ${domain}. Run a scan first.`, needsScan: true, report: null }, { status: 409 });
  }

  const prompts = latest.geo.observations.map((o) => o.prompt).filter(Boolean);
  if (prompts.length === 0) {
    return NextResponse.json({ error: "No prompts in the latest scan to probe.", report: null }, { status: 409 });
  }

  try {
    const results = await runMultiEngineProbes({
      engines: getConfiguredEngines(),
      prompts,
      brandGuess: latest.project.brandGuess,
      domain: domainKey(domain),
    });
    return NextResponse.json({ report: buildCrossEngineLedger(results) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build cross-engine ledger";
    return NextResponse.json({ error: message, report: null }, { status: 500 });
  }
}
```

- [ ] **Step 4: Implement view** `components/cross-engine-ledger.tsx` — for each `report.engines[i]`: engine name, measurement badge, state (covered/absent/unmeasured), `citedShare` as %, reliability note, top competitors. Then an "absent on" callout listing `enginesAbsent`, and the `competitorUnion` (domain · engines · count). Use Card/Badge like `components/geo-fix-report.tsx`. Type against `CrossEngineLedger` imported from `@/lib/engines/geo-cross-engine-ledger`.

- [ ] **Step 5: Implement page** `app/demo/geo-engines/page.tsx` — mirror `app/demo/geo-fixes/page.tsx`: `useLiveAnalyze`, fetch `/api/geo-engines?domain=`, render `CrossEngineLedgerView`, `EmptyLiveState` when no live scan, `PageHeader` title "Cross-engine visibility".

- [ ] **Step 6: Nav** — in `components/app-sidebar.tsx` add `{ href: "/demo/geo-engines", title: "Cross-engine visibility", icon: Radar }` after AI visibility (Radar already imported; pick an unused icon such as `Globe` and add to the import).

- [ ] **Step 7: Run route test — expect pass. typecheck + lint + full `npm test` + `npm run build`.**

- [ ] **Step 8: Commit** `feat(geo): cross-engine visibility surface — API + dashboard (GIL-ME-5)`.

---

## Self-Review

**Spec coverage:** ME-1 adapters (Task 1), ME-2 orchestrator (Task 2), ME-3 cross-engine ledger (Task 3), ME-4 registry (Task 4), ME-5 surface (Task 5). Every spec §maps to a task; honesty rules (mock=simulated, absent-only-when-answered, per-engine reliability, failing-engine isolation) are exercised by Task 3/4 tests and enforced in code.

**Placeholder scan:** none — every code step is complete except the view/page (Task 5 steps 4–6), which are described concretely and mirror an existing committed component/page; the route + its test are full code.

**Type consistency:** `EngineSpec` (Task 2) is the single shape returned by the registry (Task 4) and consumed by the orchestrator; `EngineGeoResult` (Task 2) is consumed by `buildCrossEngineLedger` (Task 3); `GeoAnswerProvider` (Task 1 output) matches `runGeoProbes`'s parameter; `measurement` union `"measured"|"simulated"|"estimate"` is identical across ME-2/3/4.
