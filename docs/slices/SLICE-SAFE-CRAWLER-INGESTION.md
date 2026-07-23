# SLICE-SAFE-CRAWLER-INGESTION

## Problem

The audit API was mock-only. The product needed a safe provider-backed ingestion path that could normalize real page evidence without making live crawling the default.

## User Outcome

When `OPENGROWTH_REAL_CRAWL=true`, `/api/audit` can fetch one public HTML page, normalize SEO signals, and return them with the audit response. When crawling is disabled or unsafe, deterministic demo mode continues to work.

## Scope

- Add normalized crawl evidence.
- Add a `SafeWebsiteCrawler` provider.
- Validate DNS and block private/local targets before request and after redirect.
- Add request timeout, content-type check, and response byte cap.
- Extract title, meta description, canonical, headings, links, images, structured data, robots, Open Graph, Twitter tags and word count.
- Wire `/api/audit` to use the crawler only when explicitly enabled.
- Add unit tests and provider documentation.

## Exclusions

- No multi-page crawler.
- No sitemap or robots fetcher.
- No live audit-rule generation from crawl evidence yet.
- No crawl persistence.

## Acceptance Criteria

- Complete: crawler is opt-in.
- Complete: unsafe/private hosts are blocked.
- Complete: HTML is normalized into structured page evidence.
- Complete: mock audit fallback remains available.
- Complete: tests and build pass.

## Known Limitations

- Network access depends on the runtime environment.
- Audit issues remain simulated in the API response.
- DNS rebinding protection should be hardened further before production.

## Next Logical Slice

Connect live crawl evidence to the deterministic technical audit rule engine.
