# Provider integrations

Provider interfaces live in `lib/providers/contracts.ts`. Mock implementations are the default and must remain available for local development and tests.

## Adapter rules

Adapters validate and normalize upstream responses, declare their source, time out, cap payload sizes, and map provider errors into application errors. UI code must not import provider SDK response types.

- `WebsiteCrawler`: fetches permitted public pages with DNS/private-network checks, per-hop redirect revalidation (max 5), ports 80/443 only, timeout and size controls. Live audit ingestion is opt-in with `OPENGROWTH_REAL_CRAWL=true`; mock mode remains the default.
- `AuditProvider`: returns normalized issues.
- `SearchOpportunityProvider` (`lib/providers/search.ts`): `DemoSearchProvider`, live `SearchConsoleAdapter` (`GSC_SITE_URL` + `GSC_ACCESS_TOKEN`), and HTTP `KeywordProviderAdapter` (`KEYWORD_PROVIDER_URL`, optional `KEYWORD_PROVIDER_API_KEY`). `getSearchOpportunityProvider()` selects via `OPENGROWTH_SEARCH_PROVIDER=auto|demo|search-console|keyword-provider`.
- `KeywordProvider` and `SearchDataProvider` (contracts): return sourced, market-aware search signals.
- Competitor homepage crawl: `POST /api/competitors` safely crawls a public competitor URL (same SSRF guards) and compares readiness/proof/CTA/schema against the latest analyze snapshot.
- `CompetitorProvider`: returns directional comparisons with unavailable fields explicit.
- `AITextProvider`: returns structured, review-required assets.
- `AnalyticsProvider`: receives the fixed product event vocabulary.

## Adding a model

Implement `AITextProvider`, select it through an environment-aware factory, keep credentials server-only, add rate limits and structured output validation, then label provider/model provenance in activity data. OpenAI, Anthropic, Gemini and local model environment keys are reserved in `.env.example`; none is currently connected.

## Current crawler state

The crawler is a hardened single-page ingestion adapter: SSRF DNS checks, metadata/private IP blocks, port allowlist (80/443), and manual redirect following with revalidation on every hop (max 5). `/api/audit` returns normalized crawl evidence and technical issues when `OPENGROWTH_REAL_CRAWL=true`. If the crawl fails or is unsafe, the endpoint returns a simulated fallback with `crawlError` rather than bypassing controls.

## Search demand providers

`GET /api/opportunities` uses `getSearchOpportunityProvider()`. Without GSC or keyword credentials it returns labelled demo estimates (`simulated: true`). With GSC credentials it calls Search Analytics and labels rows as `search-console` / not estimated. With only `KEYWORD_PROVIDER_URL`, it POSTs `{ services, audiences, market }` and expects `{ signals: [{ query|keyword, monthlySearches|volume, competitionIndex|competition, service?, topic? }] }`.

Audit responses are persisted locally through `FileAuditRunRepository` at `.opengrowth/audit-runs.json` by default. Override with `OPENGROWTH_AUDIT_STORE_PATH`. Set `OPENGROWTH_AUDIT_STORE=prisma` to use the project-scoped `PrismaAuditRunRepository` against PostgreSQL. The Prisma adapter requires an existing, authorized project row; authentication/organization context should pass `organizationId` when wired into a production request.
