# Design — Open-Source Ingestion Stack (Crawlee · Firecrawl · OpenSearch)

**Date:** 2026-07-24
**Cluster prefix:** `OSI`
**Slice:** `docs/slices/SLICE-OPEN-SOURCE-INGESTION.md`
**Approach:** A — Crawl-depth first. Contract-first adapters; defaults stay zero-dependency; heavy tools are opt-in.

## Goal

Maximize genuine leverage from open-source tooling **without** compromising the lean
TypeScript architecture or the auditable-evidence non-negotiables. Concretely:

- **Crawlee** → the fetch/orchestration engine (multi-page frontier, JS render, retries).
- **Firecrawl** → the extraction/normalization layer (clean LLM-ready markdown + structured JSON).
- **OpenSearch** → optional evidence corpus + retrieval backbone (keyword + vector).

Explicitly **out of scope:** Apache Nutch and YaCy — JVM/Hadoop and P2P models fight the
lean TS runtime and the "auditable, controllable evidence" non-negotiable. **Elmo GEO** is
a design reference only, not embedded.

## Why this scope

The current crawler is a hardened **single-page** `SafeWebsiteCrawler` (cheerio + SSRF
guards, opt-in via `OPENGROWTH_REAL_CRAWL`) behind the `WebsiteCrawler` contract. There is
no search index; demand and GEO signals derive from that crawl plus LLM prompt-universe
probes. The highest-value upgrades are therefore (1) crawl *depth* and (2) *extraction
quality*, with a retrieval backbone as an optional third layer once richer data justifies it.

## Architecture

Everything hangs off **provider contracts**, mirroring the existing `WebsiteCrawler` /
`getSearchOpportunityProvider()` pattern. The mock/single-page path is always the default;
each tool is an env-selected adapter. Nothing new is *required* to run `npm run dev` or tests.

### New contracts (`lib/providers/contracts.ts`)

```ts
// Multi-page frontier crawl → Crawlee's home
interface SiteCrawler {
  crawlSite(seed: string, opts: {
    maxPages: number; maxDepth: number;
    sameOriginOnly: boolean; render?: "http" | "browser";
    timeoutMs?: number;
  }): Promise<CrawledPageEvidence[]>;   // reuses the existing evidence type
}

// Clean extraction → Firecrawl's home
interface ContentExtractor {
  extract(url: string, opts?: { schema?: unknown }): Promise<{
    markdown: string; structured?: unknown; source: "firecrawl" | "cheerio";
  }>;
}

// Optional retrieval backbone → OpenSearch's home (Phase 3)
interface EvidenceIndex {
  upsert(docs: EvidenceDoc[]): Promise<void>;
  search(q: { text?: string; vector?: number[]; filters?: Record<string, string>; k: number }):
    Promise<EvidenceHit[]>;
}
```

### Selection factories (`lib/providers/*`)

- `getSiteCrawler()` → `OPENGROWTH_SITE_CRAWLER=mock|crawlee` (default `mock`)
- `getContentExtractor()` → `OPENGROWTH_EXTRACTOR=cheerio|firecrawl` (default `cheerio`)
- `getEvidenceIndex()` → `OPENGROWTH_EVIDENCE_INDEX=memory|opensearch` (default `memory`)

### Role boundaries (no overlap)

- **Crawlee** fetches pages into the frontier and returns normalized `CrawledPageEvidence`.
- **Firecrawl** only *extracts* clean content from a URL/HTML — its own crawl mode is unused
  so SSRF enforcement stays in one place (Crawlee/`SafeWebsiteCrawler`).
- **OpenSearch** only *stores + retrieves* — it never fetches the web.

## Data flow

```
seed URL ──► SiteCrawler (Crawlee, SSRF-guarded) ──► CrawledPageEvidence[]
                                   │
                                   ├──► live-audit / site-audit / content-inventory  (site-wide issues)
                                   ├──► competitor-crawl                              (N-page comparison)
                                   ▼
                        ContentExtractor (Firecrawl) ──► clean markdown + structured
                                   │
                                   ├──► geo-extract / content-gap / claim-validation  (higher-signal input)
                                   ▼
                          EvidenceIndex (OpenSearch, opt-in) ──► retrieval / citation-match / RAG
```

## Safety & evidence honesty (non-negotiable)

- Every fetch runs through the existing SSRF guards (`assertPublicHost`, `isPrivateAddress`),
  per redirect hop, ports 80/443 only. Crawlee's request handler calls these before each request.
- Every adapter stamps `source` on every record → provenance is always auditable; no fake data.
- Heavy tools (Firecrawl self-host, OpenSearch) are opt-in via env + docker-compose; absence
  yields the labelled default path, never a silent failure.
- GEO output stays directional; retrieval never manufactures a citation it cannot evidence.

## Error handling

- Adapter failure (crawl timeout, extractor down, index unreachable) degrades to the default
  adapter with an explicit `*Error` field on the result — same contract as `crawlError` today.
- Per-crawl hard caps (`maxPages`, `maxDepth`, `timeoutMs`, max bytes) prevent runaway crawls.
- OpenSearch unreachable → `getEvidenceIndex()` falls back to `memory` and logs, never throws
  into a request path.

## Testing

- **Unit:** each adapter against a fake fetch/client; SSRF rejection paths; source labelling;
  cap enforcement; default-fallback on failure.
- **Contract:** mock and real adapters satisfy the same interface tests.
- **Integration:** Crawlee against a local fixture site; Firecrawl against a self-host container
  (skipped when `OPENGROWTH_EXTRACTOR!=firecrawl`); OpenSearch against a compose container
  (skipped when index != opensearch).
- Every epic ships with `typecheck`, `lint`, `build`, `vitest` green before the next starts.

## Epics

See `docs/slices/SLICE-OPEN-SOURCE-INGESTION.md`. Build order is strict; each epic is
independently testable and shippable.

| Epic | What it delivers | Depends on |
|---|---|---|
| **OSI-001** | Contracts & factories + default mock adapters (reuse SSRF guards). | — |
| **OSI-002** | Crawlee `SiteCrawler` adapter (multi-page, SSRF-wrapped, capped). | 001 |
| **OSI-003** | Full-site audit wiring (multi-page evidence → audit/inventory engines). | 002 |
| **OSI-004** | Multi-page competitor crawl (upgrade `competitor-crawl.ts`). | 002 |
| **OSI-005** | Firecrawl `ContentExtractor` adapter (markdown + structured, labelled). | 001 |
| **OSI-006** | GEO + content engines consume clean extraction. | 005 |
| **OSI-007** | OpenSearch `EvidenceIndex` adapter (keyword + optional vector). | 001 |
| **OSI-008** | Index the evidence corpus (pages + GEO observations + citations). | 007, 002 |
| **OSI-009** | Retrieval-backed features (citation-match / RAG / insufficient-evidence). | 008 |
| **OSI-010** | Close-out: docker-compose, `.env.example`, docs, `EPIC_STATUS`. | all |

## Phasing

- **Phase 1 (crawl depth):** OSI-001 → 002 → 003 → 004. Ships the biggest immediate win
  (whole-site + multi-page competitor evidence) with zero new services.
- **Phase 2 (extraction quality):** OSI-005 → 006. Adds Firecrawl (first opt-in service).
- **Phase 3 (retrieval, opt-in):** OSI-007 → 008 → 009. Adds OpenSearch backbone.
- **Close-out:** OSI-010.
