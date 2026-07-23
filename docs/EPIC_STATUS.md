# Epic Status

| Area | Current Status | Evidence | Decision |
|---|---|---|---|
| Product shell | Functional demo | Routes under `app/`, workspace shell, landing, onboarding, dashboard | Preserve |
| Demo data | Functional but static | `lib/data/demo.ts` | Extend rather than replace |
| Provider abstraction | Basic | `lib/providers/contracts.ts`, `lib/providers/mock.ts` | Extend only where needed |
| Persistence | Functional local + Prisma adapter | `FileAuditRunRepository`, `PrismaAuditRunRepository`, `prisma/schema.prisma`, `/api/audit/latest` | Keep file default; wire authenticated org context and migrations |
| Recommendation intelligence | Functional demo intelligence | Evidence-linked recommendations, score components, assumptions, completion criteria and measurement plans | Preserve and feed with future engines |
| Evidence provenance | Functional demo contract | `EvidenceReference` type, seeded evidence, Prisma model, detail UI | Extend with real provider records |
| Website audit | Functional demo rules | `TechnicalPageObservation`, `buildTechnicalAuditIssues`, audit evidence UI | Preserve and feed with real crawler |
| Safe crawler ingestion | Functional opt-in provider | `SafeWebsiteCrawler`, `/api/audit` `OPENGROWTH_REAL_CRAWL=true` path | Connect crawler evidence to audit rules next |
| AI visibility | Functional demo observations | `lib/engines/ai-visibility.ts`, `/demo/ai-visibility`, Prisma observation models | Preserve and connect to real providers |
| Citation intelligence | Functional demo actions | `buildCitationGapActions`, citation action UI | Preserve and connect to live citation verification later |
| Content opportunities | Functional demo intelligence | `buildBusinessAwareContentOpportunities`, evidence-backed brief modal | Preserve and feed with real page/search evidence |
| Content execution | Mock | `GenerationWorkspace`, `MockAITextProvider` | Later connect to evidence |
| Outcome learning | Functional demo records | `buildOutcomeLearningRecords`, `/demo/outcomes`, Prisma outcome model | Preserve and connect to analytics/Search Console later |
| Unified growth intelligence | Functional demo synthesis | `buildUnifiedGrowthDecisions`, dashboard panel, guardrail tests | Preserve and feed with persisted provider evidence |

## Active Decision

This run has continued P0 engine work slice by slice: evidence-backed recommendations, business-aware content gaps, evidence-backed technical audit rules, and AI visibility observations. It did not rebuild the landing page, redesign the dashboard, or add auth.

The latest slice adds PostgreSQL persistence for audit runs, normalized issues, crawl metadata, and provenance evidence behind the same repository contract. Prisma mode is opt-in with `OPENGROWTH_AUDIT_STORE=prisma`; local demo mode remains file-backed.
