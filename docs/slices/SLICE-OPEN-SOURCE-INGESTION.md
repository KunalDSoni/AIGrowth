# SLICE — Open-Source Ingestion Stack (Crawlee · Firecrawl · OpenSearch)

**Cluster prefix:** `OSI`
**Design:** `docs/superpowers/specs/2026-07-24-open-source-ingestion-stack-design.md`
**Approach:** A — Crawl-depth first. Contract-first adapters; defaults stay zero-dependency; heavy tools opt-in.

Build order is strict; each epic is independently testable (TDD) and shippable before the next.
Defaults are always the no-dependency option (`mock` / `cheerio` / `memory`) so the demo and tests
never require these tools to run.

| Epic ID | Epic | What it delivers | Depends on | Status |
|---|---|---|---|---|
| **OSI-001** | Contracts & factories | `SiteCrawler`, `ContentExtractor`, `EvidenceIndex` interfaces in `lib/providers/contracts.ts`; `getSiteCrawler()`/`getContentExtractor()`/`getEvidenceIndex()` factories with env selection; default mock adapters; reuse `assertPublicHost`/`isPrivateAddress`. | — | Todo |
| **OSI-002** | Crawlee `SiteCrawler` | Multi-page frontier crawl adapter (`maxPages`/`maxDepth`/`sameOriginOnly`/`render`), SSRF-guarded per hop, returns `CrawledPageEvidence[]`. Env `OPENGROWTH_SITE_CRAWLER=crawlee`. | 001 | Todo |
| **OSI-003** | Full-site audit wiring | Feed multi-page evidence into `live-audit`/`site-audit`/`content-inventory`; produce site-wide issues instead of single-page. | 002 | Todo |
| **OSI-004** | Multi-page competitor crawl | Upgrade `competitor-crawl.ts` from homepage-only to N-page competitor crawl via `SiteCrawler`; same SSRF guards. | 002 | Todo |
| **OSI-005** | Firecrawl `ContentExtractor` | `extract(url)` → clean markdown + structured JSON, `source`-labelled; self-host/API selected by env. Default `cheerio`. Env `OPENGROWTH_EXTRACTOR=firecrawl`. | 001 | Todo |
| **OSI-006** | Engines consume extraction | Route clean markdown into `geo-extract`/`content-gap`/`claim-validation` for higher-signal input; provenance preserved. | 005 | Todo |
| **OSI-007** | OpenSearch `EvidenceIndex` | `upsert`/`search` (keyword + optional vector); `memory` default, `opensearch` opt-in via env + docker-compose. Unreachable → falls back to `memory`, never throws into a request. | 001 | Todo |
| **OSI-008** | Index the evidence corpus | Pipe crawled pages + GEO observations + citations into `EvidenceIndex`; each doc carries provenance/source. | 007, 002 | Todo |
| **OSI-009** | Retrieval-backed features | Citation-matching / RAG lookups / "insufficient evidence" checks query `EvidenceIndex`; directional labels preserved. | 008 | Todo |
| **OSI-010** | Close-out & docs | `docker-compose` for Firecrawl + OpenSearch; `.env.example` keys; update `ARCHITECTURE.md`, `API_PROVIDERS.md`, `EPIC_STATUS.md`, feature-backlog. | all | Todo |

## Phasing

- **Phase 1 — crawl depth:** OSI-001 → 002 → 003 → 004 (zero new services).
- **Phase 2 — extraction quality:** OSI-005 → 006 (Firecrawl, first opt-in service).
- **Phase 3 — retrieval (opt-in):** OSI-007 → 008 → 009 (OpenSearch backbone).
- **Close-out:** OSI-010.

## Acceptance criteria (slice)

- New adapters sit behind contracts; mock/`cheerio`/`memory` remain the defaults and keep the demo zero-setup.
- Every fetch runs through existing SSRF guards; every record declares `source`.
- Heavy tools (Firecrawl, OpenSearch) are opt-in via env; their absence yields the labelled default path, not a failure.
- Per-epic: `typecheck`, `lint`, `build`, unit/contract tests green before the next epic starts.

## Non-negotiables (inherited)

No fake data · provenance on every record · SSRF guards wrap every fetch · GEO directional only ·
heavy tools opt-in, never required · **Nutch/YaCy excluded; Elmo GEO reference-only**.
