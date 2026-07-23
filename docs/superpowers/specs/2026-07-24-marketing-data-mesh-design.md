# Design — Marketing Data Mesh (AnswerEngine · Lighthouse · SearXNG · Common Crawl)

**Date:** 2026-07-24
**Cluster prefix:** `MDM`
**Slice:** `docs/slices/SLICE-MARKETING-DATA-MESH.md`
**Companion to:** `docs/slices/SLICE-OPEN-SOURCE-INGESTION.md` (OSI). OSI stays as-is; MDM reuses its contract pattern.

## Goal

Turn the contract-first ingestion layer into a **pluggable data mesh** for the wider
SEO/GEO/marketing tool market. Every category becomes a contract; every vendor or open-source
tool is an adapter behind it, with the same non-negotiables: mock defaults, `source`
provenance on every record, opt-in heavy tools, and no fake data.

Four adapters, chosen for being free/OSS, on-mission, and differentiating:

- **AnswerEngineProvider** — real GEO citation measurement (Perplexity / OpenAI / Anthropic /
  Google AI Overviews) → turns GEO from *simulation* into *measured presence*.
- **Lighthouse** — OSS, Node-native Core Web Vitals + performance audit.
- **SearXNG** — self-host metasearch → free SERP positions + citation verification.
- **Common Crawl** — open web corpus → free backlink/authority graph + `EvidenceIndex` seeding.

## The honesty upgrade (why this matters)

Today GEO signal is LLM prompt-universe **simulation** — correctly labelled "directional."
MDM introduces a **measurement provenance label** on every GEO/SEO signal:

- `measured` — observed from a real answer engine or SERP (e.g. "cited in Perplexity for query X").
- `simulated` — LLM prompt-universe probe (existing behaviour).
- `estimate` — modelled/derived (e.g. authority from Common Crawl webgraph).

This label is mandatory on every record MDM produces and surfaces in the UI. It is the moat
paid tools (Profound, Otterly, AthenaHQ) charge for — we make it explicit and auditable.

## Architecture

New contracts (`lib/providers/contracts.ts`), each with a mock default and env-selected adapter:

```ts
interface AnswerEngineProvider {
  ask(prompt: string, opts: { engine: string; market?: string }): Promise<{
    answer: string;
    citations: Array<{ url: string; title?: string; rank?: number }>;
    engine: string; source: string; measuredAt: string;
  }>;
  readonly engines: string[];   // e.g. ["perplexity","openai","anthropic"]
}

interface SerpProvider {
  search(query: string, opts: { market?: string; num?: number }): Promise<{
    results: Array<{ url: string; title: string; rank: number; snippet?: string }>;
    source: string; observedAt: string;
  }>;
}

interface PerformanceProvider {
  audit(url: string): Promise<{
    metrics: Record<string, number>;   // LCP, CLS, INP, TBT, performance score
    issues: AuditIssue[];              // normalized into existing type
    source: string; observedAt: string;
  }>;
}

interface BacklinkProvider {
  authority(domain: string): Promise<{
    backlinks: Array<{ from: string; to: string; anchor?: string }>;
    authorityScore?: number;
    source: string; observedAt: string;
  }>;
}
```

Factories mirror the existing pattern; defaults are always the zero-dependency mock:

- `getAnswerEngineProvider()` → `OPENGROWTH_ANSWER_ENGINE=mock|perplexity|openai|anthropic|aio`
- `getSerpProvider()` → `OPENGROWTH_SERP=mock|searxng`
- `getPerformanceProvider()` → `OPENGROWTH_PERF=mock|lighthouse|psi`
- `getBacklinkProvider()` → `OPENGROWTH_BACKLINKS=mock|common-crawl|open-pagerank`

## Adapter notes

- **AnswerEngineProvider:** Perplexity/OpenAI/Anthropic via their APIs (opt-in, keys server-only,
  rate-limited). Google **AI Overviews** has no official API → derived via `SerpProvider` and
  labelled `estimate`, never `measured`. Cost/rate caps enforced; results cached in the crawl
  store (OSI-006) to avoid re-querying.
- **Lighthouse:** run headless locally (Node) or via PageSpeed Insights API (free key). Feeds
  `technical-audit.ts`; metrics normalized to existing `AuditIssue` severities.
- **SearXNG:** self-host container; no API keys, no vendor lock-in. Powers rank positions and
  **citation verification** — cross-check an answer-engine citation actually ranks.
- **Common Crawl:** query the public webgraph / index (or OpenPageRank free API) for authority +
  backlinks; optionally seed OSI's `EvidenceIndex` from CC segments (`source: "common-crawl"`)
  without crawling the live web. Heaviest data lift — kept last.

## Safety & non-negotiables

- Any adapter that fetches the live web reuses OSI's SSRF guards + robots/politeness.
- Every record carries `source` **and** a `measured|simulated|estimate` label.
- Answer-engine and paid adapters are opt-in; absence yields the labelled mock/simulated path.
- GEO stays directional unless a `measured` observation backs it.
- API keys server-only; per-provider rate limits; cost caps on answer-engine calls.

## Error handling

- Adapter unreachable / over budget → factory falls back to mock, logs, sets a `*Error` field,
  never throws into a request path.
- Answer-engine partial failure (one engine down) → return the engines that responded, mark the
  rest unavailable (explicit, not hidden).

## Testing

- **Unit:** each adapter against a fake client; provenance + measurement-label correctness;
  rate/cost-cap enforcement; fallback-to-mock on failure.
- **Contract:** mock and real adapters satisfy the same interface tests.
- **Integration:** Lighthouse against a fixture page; SearXNG against a compose container
  (skipped unless `OPENGROWTH_SERP=searxng`); answer engines behind a recorded-fixture harness
  (no live paid calls in CI).

## Epics

See `docs/slices/SLICE-MARKETING-DATA-MESH.md`. Strict build order; each epic independently
testable and shippable.

| Epic | What it delivers | Depends on |
|---|---|---|
| **MDM-001** | Contracts & factories (`AnswerEngineProvider`, `SerpProvider`, `PerformanceProvider`, `BacklinkProvider`) + mock defaults + measurement-label type. | — |
| **MDM-002** | AnswerEngineProvider adapters (Perplexity/OpenAI/Anthropic) → normalized citation observations. | 001 |
| **MDM-003** | Wire measured GEO into `ai-visibility`/`citation-intelligence`; `measured` vs `simulated` labels in report + UI. | 002 |
| **MDM-004** | Lighthouse `PerformanceProvider` → Core Web Vitals + perf issues into `technical-audit`. | 001 |
| **MDM-005** | SearXNG `SerpProvider` → SERP positions + citation verification (grounds answer-engine claims). | 001 |
| **MDM-006** | Common Crawl `BacklinkProvider` → authority/backlink graph into competitor/authority signals. | 001 |
| **MDM-007** | Common Crawl corpus seeding of OSI `EvidenceIndex` (`source: common-crawl`), no live crawl. | 001, OSI-010/011 |
| **MDM-008** | Close-out: docker-compose (SearXNG), `.env.example`, docs, `EPIC_STATUS`, cross-link OSI. | all |

## Phasing

- **Phase 1 — GEO credibility (highest value):** MDM-001 → 002 → 003.
- **Phase 2 — technical + SERP truth:** MDM-004 → 005.
- **Phase 3 — authority + corpus scale:** MDM-006 → 007.
- **Close-out:** MDM-008.

## Relationship to OSI

OSI supplies crawl, extraction, and the `EvidenceIndex`. MDM adds *external measurement*
(answer engines, SERP, performance, authority) on top of the same contract pattern. Build OSI
Phase 1 first (crawl depth is a dependency-free win); MDM Phase 1 (answer-engine measurement)
can run in parallel since it only needs MDM-001. MDM-007 is the one true cross-dependency —
it needs OSI's `EvidenceIndex` (OSI-010/011).
