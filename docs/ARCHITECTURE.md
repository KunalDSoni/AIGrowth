# Architecture

OpenGrowth separates domain data from providers and presentation. Pages consume normalized `Recommendation`, `AuditIssue`, `ContentOpportunity`, and `GeneratedAsset` types—not Google, crawling, keyword, or model-specific payloads.

## Modules

- **Project context:** business profile, goal, audience, market, tone and competitors.
- **Website analysis:** `WebsiteCrawler` and `AuditProvider` contracts; deterministic mock audit by default.
- **Recommendation engine:** transparent impact/confidence/relevance/effort scoring and severity grouping.
- **Content engine:** business-fit ranking independent of exact keyword volume.
- **AI execution:** `AITextProvider`; the mock adapter is selected by default and API responses name the provider.
- **Competitor engine:** normalized comparison; unavailable backlink/social sources remain visible as unconnected.
- **Analytics:** event vocabulary with a no-network demo implementation.
- **Persistence:** browser state for zero-setup demo; Prisma/PostgreSQL relational schema for production.

## Request flow

Onboarding validates a public URL and stores business context. The analysis screen drives a deterministic audit sequence, then the dashboard loads normalized seeded recommendations. A recommendation can create a mock asset, approve it and persist completion locally. Production adapters can replace each mock behind the same interface.

## Authentication and tenancy

The demo is intentionally unauthenticated. The schema supports users, organizations and memberships. Production routes must resolve organization membership server-side for every project mutation; client project IDs must never be trusted for authorization.

## Internationalization and open-core readiness

Market and tone are explicit profile fields; user-facing copy can move to message catalogs without changing domain records. Provider contracts, API boundaries and integration records are designed for plugins and self-hosted adapters. No open-source claim or license is made yet.
