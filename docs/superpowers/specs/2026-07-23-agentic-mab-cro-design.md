# Agentic Marketing & Thompson Sampling CRO — Design

**Date:** 2026-07-23  
**Status:** Approved (user: go)  
**Product:** OpenGrowth AI Engine  
**Slice:** Product-fit first slice with production-ready contracts

## Decision

Ship a working local core in this Next.js/TypeScript app:

1. Thompson Sampling multi-armed bandit with sticky bucketing  
2. SDR lead enrichment pipeline reusing SSRF-safe crawl + audit  
3. Premium audit report artifacts (HTML now; Playwright PDF when available)  
4. File-backed stores with interfaces for Redis / S3 later  

Defer: live Maps HTML scraping, mandatory Redis/S3, unverified edge &lt;20ms claims.

## Architecture

```text
Visitor → GET /api/bandit/select (sticky cookie) → arm payload
       → POST /api/bandit/event { converted } → update α/β (async-safe file/memory store)

Niche → POST /api/sdr/jobs → background job
     → ProspectSource → SafeWebsiteCrawler → audit/readiness flags
     → AuditPdfAgent → ObjectStore → report URL
```

## Bandit

- Prior: `Beta(1,1)` per arm  
- Select: sample θᵢ ~ Beta(αᵢ, βᵢ); choose argmax; sticky assignment by `visitorId`  
- Convert → α += 1; fail → β += 1  
- `BanditStore`: Memory + File (`.data/bandit/`); Redis adapter stub interface only  
- Traffic share from assignment counts (exploration preserved by Thompson Sampling)

## SDR

- `ProspectSource`: Demo seed list; Places adapter fails with NOT_CONFIGURED until keyed  
- Enrich with crawl + live audit + LocalBusiness schema heuristic  
- Flags: poor readiness, thin content, missing local schema  

## Reports

- HTML template → `.data/reports/{id}.html`  
- Optional Playwright PDF when `OPENGROWTH_PDF=playwright`  
- Served at `GET /api/reports/[id]`

## Honesty

- Demo prospects labelled simulated  
- No fake Lighthouse scores; use readiness/crawl proxies unless Lighthouse adapter configured  
- Bandit select path kept CPU-cheap; latency measured in tests, not claimed as edge
