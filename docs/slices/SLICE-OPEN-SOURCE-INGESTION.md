# SLICE — Open-Source Ingestion Stack (Crawlee · Firecrawl · OpenSearch)

**Cluster prefix:** `OSI`
**Design:** `docs/superpowers/specs/2026-07-24-open-source-ingestion-stack-design.md`
**Approach:** A — Crawl-depth first. Contract-first adapters; defaults stay zero-dependency; heavy tools opt-in.

Build order is strict; each epic is independently testable (TDD) and shippable before the next.
Defaults are always the no-dependency option (`mock` / `cheerio` / `memory`) so the demo and tests
never require these tools to run.

| Epic ID | Epic | What it delivers | Depends on | Status |
|---|---|---|---|---|
| **OSI-001** | Contracts & factories | `SiteCrawler`, `ContentExtractor`, `EvidenceIndex`, `EmbeddingProvider` interfaces in `lib/providers/contracts.ts`; `get*()` factories with env selection; default mock adapters; reuse `assertPublicHost`/`isPrivateAddress`. | — | Todo |
| **OSI-002** | Crawlee `SiteCrawler` | Multi-page frontier crawl (`maxPages`/`maxDepth`/`sameOriginOnly`/`render`), SSRF-guarded per hop, **robots.txt respect + crawl-delay/rate-limiting**, returns `CrawledPageEvidence[]`. Env `OPENGROWTH_SITE_CRAWLER=crawlee`. | 001 | Todo |
| **OSI-003** | Full-site audit wiring | Feed multi-page evidence into `live-audit`/`site-audit`/`content-inventory`; site-wide issues instead of single-page. | 002 | Todo |
| **OSI-004** | Multi-page competitor crawl | Upgrade `competitor-crawl.ts` from homepage-only to N-page competitor crawl via `SiteCrawler`; same SSRF + robots guards. | 002 | Todo |
| **OSI-005** | AI-crawler parity check | Fetch a page as an AI-crawler UA (GPTBot/ClaudeBot/etc.) vs a human UA, diff content hidden from bots, feed `ai-access.ts`. Obeys robots + SSRF. | 002 | Todo |
| **OSI-006** | Crawl store + incremental diff | Persist raw crawled pages (mirror `FileAuditRunRepository`/`.opengrowth`); recrawls diff against last run via `crawl-diff.ts`/`analyze-delta.ts` → "what changed"; avoids re-fetch for indexing. | 002 | Todo |
| **OSI-007** | Firecrawl `ContentExtractor` | `extract(url)` → clean markdown + structured JSON, `source`-labelled; self-host/API via env. Default `cheerio`. Env `OPENGROWTH_EXTRACTOR=firecrawl`. | 001 | Todo |
| **OSI-008** | Engines consume extraction | Route clean markdown into `geo-extract`/`content-gap`/`claim-validation` for higher-signal input; provenance preserved. | 007 | Todo |
| **OSI-009** | Real `EmbeddingProvider` | Local/hosted embedding adapter behind the contract; `mock` stays default. Env `OPENGROWTH_EMBEDDINGS=local|<hosted>`. | 001 | Todo |
| **OSI-010** | OpenSearch `EvidenceIndex` | `upsert`/`search` (keyword + vector via `EmbeddingProvider`); `memory` default, `opensearch` opt-in via env + docker-compose. Unreachable → falls back to `memory`, never throws into a request. | 001, 009 | Todo |
| **OSI-011** | Index the evidence corpus | Pipe crawled pages + GEO observations + citations into `EvidenceIndex`; each doc carries provenance/source. | 010, 002 | Todo |
| **OSI-012** | Retrieval-backed features | Citation-matching / RAG lookups / "insufficient evidence" checks query `EvidenceIndex`; directional labels preserved. | 011 | Todo |
| **OSI-013** | Close-out & docs | `docker-compose` for Firecrawl + OpenSearch; `.env.example` keys; update `ARCHITECTURE.md`, `API_PROVIDERS.md`, `EPIC_STATUS.md`, feature-backlog. | all | Todo |

## Phasing

- **Phase 1 — crawl depth (zero new services):** OSI-001 → 002 → 003 → 004 → 005 → 006.
- **Phase 2 — extraction quality:** OSI-007 → 008 (Firecrawl, first opt-in service).
- **Phase 3 — retrieval (opt-in):** OSI-009 → 010 → 011 → 012 (embeddings + OpenSearch backbone).
- **Close-out:** OSI-013.

## Acceptance criteria (slice)

- New adapters sit behind contracts; mock/`cheerio`/`memory`/`mock`-embeddings remain the defaults and keep the demo zero-setup.
- Every fetch runs through existing SSRF guards **and respects robots.txt + crawl-delay**; every record declares `source`.
- Heavy tools (Firecrawl, OpenSearch, hosted embeddings) are opt-in via env; absence yields the labelled default path, not a failure.
- Per-epic: `typecheck`, `lint`, `build`, unit/contract tests green before the next epic starts.

## Non-negotiables (inherited)

No fake data · provenance on every record · SSRF + robots guards wrap every fetch · GEO directional only ·
heavy tools opt-in, never required · **Nutch/YaCy excluded; Elmo GEO reference-only**.
