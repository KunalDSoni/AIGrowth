# GIL-ME — Multi-Engine Citation Ledger — Design

**Date:** 2026-07-24
**Status:** Approved (user: "Full cross-engine ledger now")
**Product:** OpenGrowth AI Engine
**Slice:** GEO Influence Loop — widen the base. Run the loop's ledger across every
configured answer engine, not just Gemini.

## Why

The GEO Influence Loop currently sees one engine (Gemini, via `run-geo`). The
competitor teardown puts multi-engine coverage at the table-stakes floor
(Rankscale 17+, Knowatoa 7, AthenaHQ 9). Going cross-engine enriches every stage
at once: per-engine coverage, "cited on Perplexity but **absent on ChatGPT and
Gemini**", and per-engine lift proof. The building blocks exist — `AnswerEngineProvider`
already has Mock / Perplexity / OpenAI implementations — but they feed a separate
`measureGeo` path selected one-at-a-time, not the loop's ledger.

This slice maximally reuses tested code: `runGeoProbes`, `extractBrandSignals`,
and `buildCitationLedger` (GIL-01) are unchanged. The new surface area is the
adapters, the orchestrator, the cross-engine aggregator, a registry, and a surface.

## ME-1 — Engine adapters

New `lib/engines/geo-engine-adapter.ts`.

```ts
import type { AnswerEngineProvider, AnswerObservation } from "@/lib/providers/answer-engine";
import type { GeoAnswerProvider } from "@/lib/engines/run-geo";

/** Present any AnswerEngineProvider as the GeoAnswerProvider runGeoProbes consumes. */
export function answerEngineAsGeoProvider(
  engine: AnswerEngineProvider,
  name: string,
  brand?: string,
): GeoAnswerProvider;
```

`answer(prompt)` calls `engine.ask(prompt, { brand })`. On `obs.error` it throws
(so `runGeoProbes` records the probe as failed → the ledger marks it
`unanswered`). Otherwise it returns `{ rawText }` where `rawText` is the answer
text **with each native citation URL appended on its own line**, so the existing
`extractBrandSignals` in `runGeoProbes` classifies both in-text URLs and the
engine's native citations. `model` is `name`.

Also `GeminiAnswerEngine implements AnswerEngineProvider` (engines `["gemini"]`)
wrapping `GeminiVisibilityProvider` so Gemini also speaks the unified interface:
`ask(prompt)` → `{ prompt, answer: rawText, citations: [], engine: "gemini",
source: "gemini", measurement: "measured", measuredAt, brandMentioned: undefined }`.
Gemini has no native citation list; its citations are recovered from the answer
text downstream, unchanged from today.

## ME-2 — Multi-engine orchestrator

New `lib/engines/geo-multi-engine.ts`.

```ts
export interface EngineSpec {
  name: string;
  provider: AnswerEngineProvider;
  measurement: "measured" | "simulated" | "estimate";
}

export interface EngineGeoResult {
  engine: string;
  measurement: "measured" | "simulated" | "estimate";
  geo: GeoResult;
  error?: string; // set when the whole engine failed to run
}

export function runMultiEngineProbes(input: {
  engines: EngineSpec[];
  prompts: string[];
  brandGuess: string;
  domain: string;
  maxPrompts?: number;
}): Promise<EngineGeoResult[]>;
```

For each engine: wrap via `answerEngineAsGeoProvider`, call `runGeoProbes({
brandGuess, domain, services: [], provider, prompts, maxPrompts, runId })`.
Engines run sequentially or with small concurrency; a thrown error from one
engine yields an `EngineGeoResult` with `error` and an empty `geo` (sampleSize 0)
— never sinks the others. Prompt order is preserved (needed by lift re-keying).

## ME-3 — Cross-engine ledger

New `lib/engines/geo-cross-engine-ledger.ts`.

```ts
export type EngineCitationState = "covered" | "absent" | "unmeasured";

export interface EngineCitationSummary {
  engine: string;
  measurement: "measured" | "simulated" | "estimate";
  state: EngineCitationState;      // covered = cited ≥1; absent = answered, never cited; unmeasured = no answered sample
  sampleSize: number;
  reliable: boolean;               // from the engine's own ledger
  citedShare: number;              // cited / sampleSize, 0..1 2dp
  coverage: CitationLedger["coverage"];
  topCompetitors: { domain: string; count: number }[];
}

export interface CrossEngineCompetitor {
  domain: string;
  engines: string[];               // engines where this domain was cited
  totalCount: number;              // summed across engines
}

export interface CrossEngineLedger {
  engines: EngineCitationSummary[];
  enginesCovered: string[];        // brand cited at least once
  enginesAbsent: string[];         // answered but brand never cited
  enginesUnmeasured: string[];     // no answered sample (or engine errored)
  competitorUnion: CrossEngineCompetitor[]; // desc by totalCount then domain
  overallCitedShare: number;       // pooled cited / pooled answered, 0..1 2dp
  reliable: boolean;               // at least one engine reliable
}

export function buildCrossEngineLedger(results: EngineGeoResult[]): CrossEngineLedger;
```

Per engine: `buildCitationLedger(result.geo)`. `state` = `covered` if
`coverage.cited > 0`; else `absent` if `sampleSize > 0`; else `unmeasured`.
`citedShare` = `coverage.cited / sampleSize` (0 when 0). `topCompetitors` from the
engine ledger's `competitorFrequency` (top 5). `competitorUnion` merges each
engine's competitor domains (union), recording which engines cited each and the
summed count. `overallCitedShare` pools cited and answered across engines.
`reliable` if any engine ledger is reliable. Pure; input not mutated.

## ME-4 — Engine registry

New `lib/engines/geo-engine-registry.ts`.

```ts
export function getConfiguredEngines(env?: Record<string, string | undefined>): EngineSpec[];
```

Returns the engines that can actually be measured now:
- Mock always (`measurement: "simulated"`).
- Perplexity when `PERPLEXITY_API_KEY` (`measured`).
- OpenAI when `OPENAI_API_KEY` (`measured`).
- Gemini when `GEMINI_API_KEY` (`measured`), via `GeminiAnswerEngine`.

One honest source of truth for "what can we measure right now." Mock is always
present so the surface is never empty, and it is always labelled `simulated`.

## ME-5 — Surface

`GET /api/geo-engines?domain=` (`app/api/geo-engines/route.ts`): 400 without a
domain; 409 when the domain was never analysed. Resolves prompts from the latest
scan's observations; runs `runMultiEngineProbes` over `getConfiguredEngines()`;
returns `buildCrossEngineLedger(results)`. Live engines only run when their keys
are set — otherwise the report is Mock-only, clearly `simulated`. `runtime =
"nodejs"`, `maxDuration = 120`.

`/demo/geo-engines` (`app/demo/geo-engines/page.tsx`) + a `CrossEngineLedgerView`
component: per-engine coverage (cited-share + reliability + measurement label),
the **absent-on-X** callout, and the cross-engine competitor union. Sidebar nav
entry. Empty-live state when no scan.

## Honesty rules (enforced + tested)

- Each engine carries its measurement label; Mock is always `simulated`, never
  presented as measured. Google AI Overviews is out of scope here (SERP-derived
  `estimate` lives elsewhere).
- "Absent on engine X" is asserted only for engines that answered (`state:
  "absent"`); an engine with no answered sample is `unmeasured`, never absence.
- Each engine's reliability gates on its own sample (n thresholds from
  `lib/metrics`); a thin engine is flagged, not hidden.
- A failing engine is isolated with an error, never fabricated.
- Pure functions do not mutate inputs.

## Scope boundaries (YAGNI)

Out of scope: wiring the cross-engine ledger into the gap-diff/fix/lift stages
(they consume a single engine's ledger today and can be pointed at any engine
later); per-engine persistence/history; AI Overviews SERP estimate; more than the
four engines above. This slice delivers the cross-engine *measurement + diagnosis*
surface.

## Testing

- **ME-1:** `answerEngineAsGeoProvider` → a GeoObservation whose citations include
  the engine's native citation URLs (classified first-party/other) and whose
  errored ask throws (→ unanswered). `GeminiAnswerEngine.ask` returns a
  `measured` AnswerObservation with the model's text.
- **ME-2:** three fake engines (one always-cites, one never, one throws) →
  three `EngineGeoResult`s; the thrower has `error` + sampleSize 0; the others
  have real ledgers; prompt order preserved.
- **ME-3:** covered/absent/unmeasured states assigned correctly; competitor union
  merges across engines with per-engine attribution and summed counts;
  `overallCitedShare` pools correctly; `reliable` true iff any engine reliable;
  ordering deterministic.
- **ME-4:** Mock-only with no keys; adds Perplexity/OpenAI/Gemini as keys appear;
  Mock always labelled `simulated`.
- **ME-5:** route 400 (no domain), 409 (no scan), 200 with a Mock-only
  cross-engine ledger for a seeded scan (offline).
