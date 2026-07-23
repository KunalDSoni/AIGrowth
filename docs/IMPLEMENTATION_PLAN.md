# OpenGrowth AI — Implementation Plan

## Product scope

Build a demo-ready, responsive SaaS MVP centered on one excellent workflow: a business owner submits a website, completes a short conversational onboarding, watches a transparent simulated analysis, and lands in an action-first growth workspace. The workspace supports prioritized recommendations, detail views, mock AI asset generation, completion tracking, content planning, competitor insights, an audit workspace, and a context-aware growth assistant.

The MVP runs fully offline with a polished Northstar Accounting dataset. Any simulated metric, projection, competitor result, or AI output is labeled. External integrations are represented by typed provider interfaces and honest connection states.

## Architecture

- **Web application:** Next.js App Router, React, TypeScript, Tailwind CSS.
- **UI:** reusable accessible primitives and product components; server-rendered routes with focused client islands for interaction and browser persistence.
- **Application model:** normalized domain types consumed by all UI; mock providers map into those types.
- **State:** URL-driven navigation plus a small local project store for the demo, preserving generated/completed state in `localStorage`.
- **Persistence:** Prisma/PostgreSQL schema and seed design included; the running demo deliberately uses the local repository so first-run setup does not require infrastructure.
- **Services:** interfaces for crawling, audits, keywords, search data, competitors, AI text, analytics, and rate limiting. Mock implementations are default.
- **Security:** strict public-URL validation, private/local network blocking, response size/time limits in crawler contracts, no unsafe HTML rendering, and Zod validation at input boundaries.
- **Testing:** Vitest for scoring, grouping, normalization, ranking, and validation; Playwright for the critical product path.

## Folder structure

```text
app/                 App Router pages, layouts, API routes
components/          Design system and feature components
lib/domain/          Normalized entities and enums
lib/data/            Northstar seed data and repositories
lib/engines/         Scoring, grouping, audit, ranking logic
lib/providers/       External-service contracts and mock adapters
lib/security/        URL validation and request safeguards
lib/analytics/       Event tracking abstraction
prisma/              Database schema and seed
tests/unit/          Fast domain tests
tests/e2e/           Playwright journeys
docs/                Product and engineering documentation
```

## Initial data model

Core entities: User, Organization, Membership, Project, BusinessProfile, WebsitePage, AuditRun, AuditIssue, Recommendation, ContentOpportunity, GeneratedAsset, Competitor, MetricSnapshot, ActivityEvent, Integration, Conversation, and Message.

Recommendations include category, severity, priority score, business impact, estimated effort, confidence, explanation, suggested action, status, generated assets, timestamps, and optional completion date. Provider payloads never flow directly into UI components.

## Implementation phases

1. Establish the application, design tokens, typography, navigation, and reusable states.
2. Build the marketing page and progressive onboarding-to-analysis flow.
3. Seed Northstar Accounting and implement the action-first dashboard.
4. Implement recommendation detail, generation workspace, approvals, completion, and activity tracking.
5. Add audit, opportunities, competitors, assistant, settings, and community placeholder routes.
6. Add typed providers, scoring/audit/ranking engines, validation, analytics, and API routes.
7. Add Prisma schema/seed path and all requested documentation.
8. Add unit and E2E tests; run typecheck, lint, tests, and production build.
9. Review responsiveness, accessibility, error/empty/loading states, copy, and visual consistency.

## Risks and controls

- **Scope breadth:** prioritize a deeply connected demo journey; secondary surfaces remain useful and clearly label future integrations.
- **No external credentials/network:** make mock mode first-class and deterministic.
- **Misleading projections:** label all volume, traffic, lead, and impact values as simulated estimates; explain assumptions.
- **SSRF in future crawling:** only permit HTTP(S) public hosts, resolve and reject private IP ranges server-side, enforce redirects/timeouts/size limits, and respect robots rules.
- **Client-only demo persistence:** document that it is not multi-user or durable; Prisma is the production persistence path.
- **AI safety and quality:** return plain text/structured data, never executable markup; require review before publishing.
- **Visual overload:** default to five priorities, progressive disclosure, and business-language explanations.
- **Dependency drift:** keep dependencies small and use versions supported by the local Node runtime.

## Assumptions

- No login is required for the investor/demo journey; a demo workspace is entered directly after onboarding.
- Northstar Accounting is a fictional seeded company and all testimonials are explicitly marked demo content.
- Real crawling is limited to a safe server-side abstraction; demo analysis is deterministic.
- PostgreSQL is optional for the local demo but required for production persistence.
- Light/dark presentation follows user preference and can be toggled.
