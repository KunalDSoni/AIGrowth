# Provider integrations

Provider interfaces live in `lib/providers/contracts.ts`. Mock implementations are the default and must remain available for local development and tests.

## Adapter rules

Adapters validate and normalize upstream responses, declare their source, time out, cap payload sizes, and map provider errors into application errors. UI code must not import provider SDK response types.

- `WebsiteCrawler`: fetches permitted public pages with DNS/private-network checks, redirect checks, timeout and size controls. `SafeWebsiteCrawler` is opt-in with `OPENGROWTH_REAL_CRAWL=true`; mock mode remains the default.
- `AuditProvider`: returns normalized issues.
- `KeywordProvider` and `SearchDataProvider`: return sourced, market-aware search signals.
- `CompetitorProvider`: returns directional comparisons with unavailable fields explicit.
- `AITextProvider`: returns structured, review-required assets.
- `AnalyticsProvider`: receives the fixed product event vocabulary.

## Adding a model

Implement `AITextProvider`, select it through an environment-aware factory, keep credentials server-only, add rate limits and structured output validation, then label provider/model provenance in activity data. OpenAI, Anthropic, Gemini and local model environment keys are reserved in `.env.example`; none is currently connected.

## Current crawler state

The current crawler is a single-page ingestion adapter. `/api/audit` returns normalized crawl evidence and technical issues generated from that evidence when `OPENGROWTH_REAL_CRAWL=true`. If the crawl fails or is unsafe, the route returns a simulated fallback with `crawlError` rather than bypassing controls.

Audit responses are persisted locally through `FileAuditRunRepository` at `.opengrowth/audit-runs.json` by default. Override with `OPENGROWTH_AUDIT_STORE_PATH`. Set `OPENGROWTH_AUDIT_STORE=prisma` to use the project-scoped `PrismaAuditRunRepository` against PostgreSQL. The Prisma adapter requires an existing, authorized project row; authentication/organization context should pass `organizationId` when wired into a production request.
