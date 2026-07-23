# Design — Open-Source Ingestion Stack (Crawlee · Firecrawl · OpenSearch)

**Date:** 2026-07-24
**Cluster prefix:** `OSI`
**Slice:** `docs/slices/SLICE-OPEN-SOURCE-INGESTION.md`
**Approach:** A — Crawl-depth first. Contract-first adapters; defaults stay zero-dependency; heavy tools are opt-in.

## Goal

Maximize genuine leverage from open-source tooling **without** compromising the lean
TypeScript architecture or the auditable-evidence non-negotiables. Concretely:

- **Crawlee** → the fetch/orchestration engine (multi-page frontier, JS render, retries,
  robots.txt + politeness).
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
    respectRobots?: boolean;          // default true
    userAgent?: string;               // enables AI-crawler parity fetches
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

// Powers the vector half of EvidenceIndex (mock default keeps it real, not hollow)
interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  readonly source: string;            // "mock" | "local" | "<model>"
  readonly dimensions: number;
}
```

### Selection factories (`lib/providers/*`)

- `getSiteCrawler()` → `OPENGROWTH_SITE_CRAWLER=mock|crawlee` (default `mock`)
- `getContentExtractor()` → `OPENGROWTH_EXTRACTOR=cheerio|firecrawl` (default `cheerio`)
- `getEvidenceIndex()` → `OPENGROWTH_EVIDENCE_INDEX=memory|opensearch` (default `memory`)
- `getEmbeddingProvider()` → `OPENGROWTH_EMBEDDINGS=mock|local|<hosted>` (default `mock`)

Defaults are always the no-dependency option, so the demo and every test stay zero-setup.
Each adapter **declares its `source`** on every record → the "auditable evidence / no fake
data" non-negotiable is preserved automatically.

### Role boundaries (no overlap)

- **Crawlee** fetches pages into the frontier (robots/politeness enforced) and returns
  normalized `CrawledPageEvidence`.
- **Firecrawl** only *extracts* clean content from a URL/HTML — its own crawl mode is unused
  so SSRF enforcement stays in one place (Crawlee/`SafeWebsiteCrawler`).
- **OpenSearch** only *stores + retrieves*; **EmbeddingProvider** only *vectorizes text*.

## Data flow

```
seed URL ──► SiteCrawler (Crawlee, SSRF + robots + politeness) ──► CrawledPageEvidence[]
                                   │
                                   ├──► crawl store (persist raw) ──► crawl-diff / analyze-delta  ("what changed")
                                   ├──► live-audit / site-audit / content-inventory              (site-wide issues)
                                   ├──► competitor-crawl                                          (N-page comparison)
                                   ├──► AI-crawler parity fetch (bot UA vs human UA) ──► ai-access (hidden content)
                                   ▼
                        ContentExtractor (Firecrawl) ──► clean markdown + structured
                                   │
                                   ├──► geo-extract / content-gap / claim-validation             (higher-signal input)
                                   ▼
             EmbeddingProvider ──► EvidenceIndex (OpenSearch, opt-in) ──► retrieval / citation-match / RAG
```

## Safety & evidence honesty (non-negotiable)

- Every fetch runs through the existing SSRF guards (`assertPublicHost`, `isPrivateAddress`),
  per redirect hop, ports 80/443 only. Crawlee's request handler calls these before each request.
- **robots.txt + crawl-delay / rate limiting are enforced by default** on frontier crawls;
  parity fetches that impersonate an AI crawler UA still obey robots and SSRF.
- Every adapter stamps `source` on every record → provenance is always auditable; no fake data.
- Heavy tools (Firecrawl self-host, OpenSearch, hosted embeddings) are opt-in via env +
  docker-compose; absence yields the labelled default path, never a silent failure.
- GEO output stays directional; retrieval never manufactures a citation it cannot evidence.

## Error handling

- Adapter failure (crawl timeout, extractor down, index unreachable) degrades to the default
  adapter with an explicit `*Error` field on the result — same contract as `crawlError` today.
- Per-crawl hard caps (`maxPages`, `maxDepth`, `timeoutMs`, max bytes, crawl-delay) prevent
  runaway or abusive crawls.
- OpenSearch / hosted embeddings unreachable → factories fall back to `memory` / `mock` and
  log, never throw into a request path.

## Testing

- **Unit:** each adapter against a fake fetch/client; SSRF + robots rejection paths; source
  labelling; cap enforcement; default-fallback on failure; embedding dimensions.
- **Contract:** mock and real adapters satisfy the same interface tests.
- **Integration:** Crawlee against a local fixture site (incl. a `robots.txt` fixture);
  Firecrawl against a self-host container (skipped unless `OPENGROWTH_EXTRACTOR=firecrawl`);
  OpenSearch against a compose container (skipped unless index = opensearch).
- Every epic ships with `typecheck`, `lint`, `build`, `vitest` green before the next starts.

## Epics

See `docs/slices/SLICE-OPEN-SOURCE-INGESTION.md`. Build order is strict; each epic is
independently testable and shippable.

| Epic | What it delivers | Depends on |
|---|---|---|
| **OSI-001** | Contracts & factories (`SiteCrawler`, `ContentExtractor`, `EvidenceIndex`, `EmbeddingProvider`) + default mock adapters; reuse SSRF guards. | — |
| **OSI-002** | Crawlee `SiteCrawler` adapter — multi-page, SSRF-wrapped, **robots.txt + crawl-delay/politeness**, capped. | 001 |
| **OSI-003** | Full-site audit wiring (multi-page evidence → audit/inventory engines). | 002 |
| **OSI-004** | Multi-page competitor crawl (upgrade `competitor-crawl.ts`). | 002 |
| **OSI-005** | AI-crawler parity check — fetch as bot UA vs human, diff hidden content → `ai-access`. | 002 |
| **OSI-006** | Persistent crawl store + incremental diff (`crawl-diff`/`analyze-delta`, "what changed"). | 002 |
| **OSI-007** | Firecrawl `ContentExtractor` adapter (markdown + structured, labelled). | 001 |
| **OSI-008** | GEO + content engines consume clean extraction. | 007 |
| **OSI-009** | Real `EmbeddingProvider` adapter (local/hosted; mock stays default). | 001 |
| **OSI-010** | OpenSearch `EvidenceIndex` adapter (keyword + vector via `EmbeddingProvider`). | 001, 009 |
| **OSI-011** | Index the evidence corpus (pages + GEO observations + citations, provenance kept). | 010, 002 |
| **OSI-012** | Retrieval-backed features (citation-match / RAG / insufficient-evidence). | 011 |
| **OSI-013** | Close-out: docker-compose, `.env.example`, docs, `EPIC_STATUS`. | all |

## Phasing

- **Phase 1 (crawl depth, no new services):** OSI-001 → 002 → 003 → 004 → 005 → 006.
  Ships whole-site + multi-page competitor evidence, AI-crawler parity, and change-detection.
- **Phase 2 (extraction quality):** OSI-007 → 008. Adds Firecrawl (first opt-in service).
- **Phase 3 (retrieval, opt-in):** OSI-009 → 010 → 011 → 012. Adds embeddings + OpenSearch backbone.
- **Close-out:** OSI-013.
