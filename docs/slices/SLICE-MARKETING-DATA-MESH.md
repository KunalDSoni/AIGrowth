# SLICE — Marketing Data Mesh (AnswerEngine · Lighthouse · SearXNG · Common Crawl)

**Cluster prefix:** `MDM`
**Design:** `docs/superpowers/specs/2026-07-24-marketing-data-mesh-design.md`
**Companion to:** `docs/slices/SLICE-OPEN-SOURCE-INGESTION.md` (OSI). OSI unchanged; MDM reuses its contract pattern.

Build order is strict; each epic is independently testable (TDD) and shippable. Defaults are always
the zero-dependency mock. Every record carries `source` **and** a `measured | simulated | estimate` label.

| Epic ID | Epic | What it delivers | Depends on | Status |
|---|---|---|---|---|
| **MDM-001** | Contracts & factories | `AnswerEngineProvider`, `SerpProvider`, `PerformanceProvider`, `BacklinkProvider` in `lib/providers/contracts.ts`; `get*()` factories with env selection; mock defaults; `measured|simulated|estimate` label type; reuse OSI SSRF/robots guards where fetching. | — | Todo |
| **MDM-002** | AnswerEngine adapters | Perplexity/OpenAI/Anthropic adapters → normalized citation observations (`answer`, `citations[]`, `engine`, `measuredAt`); keys server-only; rate + cost caps; results cached via OSI crawl store. Env `OPENGROWTH_ANSWER_ENGINE`. | 001 | Todo |
| **MDM-003** | Measured GEO wiring | Feed measured citations into `ai-visibility.ts`/`citation-intelligence.ts`; surface `measured` vs `simulated` in report + UI; GEO stays directional unless `measured`. | 002 | Todo |
| **MDM-004** | Lighthouse `PerformanceProvider` | Headless Lighthouse (or PSI free API) → Core Web Vitals (LCP/CLS/INP/TBT) + perf score; normalize to `AuditIssue` and feed `technical-audit.ts`. Env `OPENGROWTH_PERF=lighthouse|psi`. | 001 | Todo |
| **MDM-005** | SearXNG `SerpProvider` | Self-host metasearch → SERP positions + **citation verification** (does an answer-engine citation actually rank?). No vendor keys. Env `OPENGROWTH_SERP=searxng`. | 001 | Todo |
| **MDM-006** | Common Crawl `BacklinkProvider` | Webgraph / OpenPageRank → backlinks + authority score into competitor/authority signals; labelled `estimate`. Env `OPENGROWTH_BACKLINKS=common-crawl|open-pagerank`. | 001 | Todo |
| **MDM-007** | Common Crawl corpus seeding | Seed OSI `EvidenceIndex` from Common Crawl segments (`source: common-crawl`) without live crawling; provenance preserved. | 001, OSI-010/011 | Todo |
| **MDM-008** | Close-out & docs | `docker-compose` (SearXNG); `.env.example` keys; update `ARCHITECTURE.md`, `API_PROVIDERS.md`, `EPIC_STATUS.md`, feature-backlog; cross-link OSI. | all | Todo |

## Phasing

- **Phase 1 — GEO credibility (highest value):** MDM-001 → 002 → 003.
- **Phase 2 — technical + SERP truth:** MDM-004 → 005.
- **Phase 3 — authority + corpus scale:** MDM-006 → 007.
- **Close-out:** MDM-008.

## Acceptance criteria (slice)

- New adapters sit behind contracts; mock defaults keep the demo zero-setup.
- Every record declares `source` **and** `measured | simulated | estimate`; the label is visible in the UI.
- Live-web fetches reuse OSI SSRF + robots guards; answer-engine keys server-only with rate/cost caps.
- Answer-engine/SERP/backlink absence yields the labelled mock path, never a failure.
- Per-epic: `typecheck`, `lint`, `build`, unit/contract tests green before the next epic starts.

## Non-negotiables (inherited)

No fake data · provenance + measurement label on every record · SSRF + robots on every live fetch ·
GEO directional unless `measured` · heavy/paid tools opt-in, never required · API keys server-only.

## Cross-slice note

Build **OSI Phase 1 first** (crawl depth is dependency-free). **MDM Phase 1 (answer-engine measurement)
can run in parallel** — it only needs MDM-001. The single true cross-dependency is **MDM-007 → OSI-010/011**
(needs the `EvidenceIndex`).
