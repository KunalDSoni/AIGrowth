# AI SEO Engine Readiness

| Dimension | Score | Repository Evidence | Missing Capability | User Impact | Technical Dependency | Recommended Priority |
|---|---:|---|---|---|---|---:|
| Business understanding | 2/5 | `components/onboarding-flow.tsx` captures profile fields; `prisma/schema.prisma` has `BusinessProfile` | Structured services, differentiators, trust signals, inferred gaps, user confirmations | Recommendations can be relevant but not deeply business-aware | Business knowledge model and persistence | P0 |
| Evidence and provenance | 2/5 | `EvidenceReference` type, seeded evidence in `lib/data/demo.ts`, Prisma `EvidenceReference` model, recommendation evidence UI | Provider-backed storage, freshness, conflict handling, cross-engine chains | Users can now inspect demo evidence behind recommendations | Real crawler/search/AI observation providers | P0 |
| Website intelligence | 3/5 | `WebsitePage` Prisma model; seeded page profiles; opt-in `SafeWebsiteCrawler` normalizes title, metadata, headings, links, images, structured data and word count | Multi-page crawl, page purpose inference, entity associations, persistence | Demo can reason over seeded pages and API can ingest one live page when enabled | Crawl storage and rule integration | P0 |
| Technical SEO | 3/5 | `buildTechnicalAuditIssues` creates evidence-linked issues from normalized observations | Broader rule coverage, persisted audit runs, multi-page canonical/indexability diagnosis | Users can inspect why a demo technical issue exists | Real crawler and audit persistence | P0 |
| Search opportunities | 3/5 | `buildBusinessAwareContentOpportunities` matches business services/audiences against seeded page profiles and evidence IDs | Real provider data, clustering, performance inputs, competitor evidence | Users can see content gaps tied to business context and missing page coverage | Safe crawler and search provider | P0 |
| AI visibility | 3/5 | Prompt families, deterministic observations, summaries, evidence records, Prisma models, `/demo/ai-visibility` UI | Real providers, scheduled repeated runs, variance over time, token/cost metadata | Users can inspect simulated AI-answer visibility with sample size and variability | Provider adapters and persistence | P0 |
| Citation intelligence | 3/5 | `buildCitationGapActions` classifies first-party/source gaps from AI visibility citations and renders actions in `/demo/ai-visibility` | Live citation verification, source opportunity workflow, third-party execution | Users can turn observed citation patterns into next actions | Real AI visibility providers | P0 |
| Recommendation engine | 3/5 | `calculateRecommendationPriority`, score components, evidence IDs, assumptions, risk, dependencies, completion criteria, measurement plans, E2E evidence UI assertion | Live multi-engine inputs, conflict/dependency handling, learning from outcomes | Users can inspect why a demo action was prioritized | Audit/search/AI visibility evidence producers | P0 |
| Content execution | 2/5 | Mock AI generation, generation workspace, approval button | Evidence-grounded briefs, claim verification, versioning | Drafts are useful demos but not production-safe | Evidence-linked recommendation context | P1 |
| Outcome learning | 3/5 | `buildOutcomeLearningRecords` creates baseline/comparison records with observed changes, external events, attribution limits and confidence; `/demo/outcomes` route | Real metric providers, persisted implementation events, stronger attribution model | Users can inspect what changed after demo implementations | Analytics and Search Console integrations | P0 |

## Candidate Slice Scores

Formula: Product Differentiation x User Value x Evidence Readiness x Dependency Readiness x Demo Impact / Implementation Cost.

| Candidate | Differentiation | User Value | Evidence Readiness | Dependency Readiness | Demo Impact | Cost | Score | Decision |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Unified evidence-backed recommendation ranking | 5 | 5 | 4 | 5 | 5 | 3 | 166.7 | Selected |
| Business-aware content gap | 4 | 5 | 4 | 4 | 5 | 3 | 106.7 | Next |
| Evidence-backed technical recommendation | 4 | 4 | 3 | 4 | 4 | 3 | 64.0 | Next |
| AI visibility observation | 5 | 4 | 1 | 3 | 5 | 4 | 18.8 | Later, after evidence model |
| Citation gap to content action | 5 | 4 | 1 | 2 | 4 | 4 | 10.0 | Depends on AI visibility |

## Completed Slices

Evidence-backed recommendation intelligence has been implemented. The recommendation detail path now shows source evidence, score components, assumptions, dependencies, risks, completion criteria, and measurement plans without rebuilding the product shell.

Business-aware content gap detection has been implemented for the deterministic demo path. Content opportunities are now generated from business profile, existing page profiles, and candidate topics, with evidence-backed briefs.

Evidence-backed technical audit rules have been implemented for the deterministic demo path. Audit issues are now created from normalized page observations and display rule evidence.

AI visibility observations have been implemented for the deterministic demo path. Prompt families generate timestamped observations, mention/citation summaries, sample sizes, and raw evidence views.

Citation gap actions have been implemented for the deterministic demo path. AI citation patterns now create first-party/source-strengthening actions with evidence IDs and measurement plans.

Outcome learning has been implemented for the deterministic demo path. Implemented actions now have baseline periods, implementation dates, comparison periods, observed changes, attribution limits and follow-up actions.

Safe single-page crawler ingestion has been implemented behind `OPENGROWTH_REAL_CRAWL=true`. It normalizes live HTML evidence while preserving deterministic demo fallback.

Unified growth intelligence has been implemented. Technical, content, AI visibility, citation and outcome signals now feed a single cross-engine decision layer with SEO guardrails.
