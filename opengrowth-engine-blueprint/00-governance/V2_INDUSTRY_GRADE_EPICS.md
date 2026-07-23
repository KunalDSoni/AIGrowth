# V2 Industry-Grade Epics, Stories, and Tasks

This is the upgraded backlog. It is stricter than the initial engine list and is designed to compete with the current AI SEO/GEO market.

## Product North Star

OpenGrowth must answer one question better than any existing tool:

> What is the next best growth action, why should I trust it, and can the AI help me execute and measure it?

## Build Rule

Do not build a feature unless it improves at least one of these:

- Evidence quality
- Decision quality
- Execution quality
- Measurement quality
- Accessibility for small businesses

---

# Epic Cluster 1: Evidence and Provenance Foundation

## EPIC EVID-001: Unified Evidence Ledger

### Goal

Create the central evidence layer used by every engine.

### Stories

- As a user, I can inspect the evidence behind every recommendation.
- As the system, I can label data as observed, estimated, simulated, AI-inferred, user-supplied, provider-supplied, stale, or insufficient.
- As an engineer, I can attach evidence from crawl, search, AI visibility, citation, competitor, content, and outcome engines using one contract.

### Tasks

- Define evidence schema and enums.
- Add evidence freshness fields.
- Add reliability scoring.
- Add source record references.
- Add evidence-to-recommendation relationship.
- Add tests proving recommendations cannot be created without evidence.

### Acceptance Criteria

- Evidence records are persisted.
- Evidence has provenance labels.
- Recommendation details can display evidence chains.
- Simulated data is visibly labelled.

## EPIC EVID-002: Evidence Drawer and Explainability UI

### Goal

Give users a simple, inspectable explanation for every decision.

### Stories

- As a user, I can open an evidence drawer from a recommendation.
- As a user, I can see which evidence is strong, weak, stale, or simulated.
- As a user, I can understand the assumption connecting evidence to action.

### Tasks

- Build evidence summary component.
- Build evidence detail drawer.
- Add labels for observed, estimated, simulated, inferred, and stale.
- Show affected assets.
- Show source engine.
- Show timestamp and freshness.

---

# Epic Cluster 2: Business Understanding Engine

## EPIC BIZ-001: Business Knowledge Graph Foundation

### Goal

Represent the business as entities and relationships instead of loose profile fields.

### Stories

- As a user, I can define services, audiences, geography, competitors, goals, and differentiators.
- As the system, I can connect pages, topics, prompts, citations, competitors, and recommendations to business entities.
- As the recommendation engine, I can prioritize high-value services and audiences.

### Tasks

- Create business entity model.
- Create service/product catalogue.
- Create audience segment model.
- Create geography model.
- Create conversion goal model.
- Create relationship table or graph abstraction.
- Add Northstar Accounting demo graph.

## EPIC BIZ-002: Assumption Confirmation Workflow

### Goal

Prevent AI-inferred business facts from silently becoming truth.

### Stories

- As a user, I can review inferred services, audiences, locations, trust signals, and competitors.
- As the system, I label each inference and store confirmation state.
- As downstream engines, confirmed facts outrank unconfirmed in scoring.

### Tasks

- Add inference status.
- Add review UI.
- Add confirm/reject/edit actions.
- Add audit event.
- Add scoring effect for confirmed vs inferred fields.

---

# Epic Cluster 3: Crawl and Website Intelligence

## EPIC CRAWL-001: Secure Crawl Core

### Goal

Safely fetch and normalize public website pages.

### Stories

- As a user, I can enter a public URL and receive safe normalized page evidence.
- As the platform, I block private networks, cloud metadata, unsafe protocols, and redirects into blocked ranges.
- As downstream engines, crawled content is treated as untrusted evidence.

### Tasks

- Implement URL validation.
- Implement DNS/IP safety checks.
- Implement redirect revalidation.
- Add timeout and response size limits.
- Extract title, description, headings, canonical, links, images, schema presence, viewport, language, and text.
- Add SSRF tests.

## EPIC CRAWL-002: Site Inventory and Page Classification

### Goal

Turn crawl output into a useful content inventory.

### Stories

- As a user, I can see pages grouped by purpose.
- As the search/content engines, I can compare business priorities against existing page coverage.

### Tasks

- Classify homepage, service page, industry page, location page, article, comparison page, FAQ, legal page, unknown.
- Store confidence and evidence.
- Add manual override.
- Build inventory view.

---

# Epic Cluster 4: Technical SEO and AI Crawler Access

## EPIC TSEO-001: Deterministic Technical Audit Rules

### Goal

Create versioned technical rules with plain-language explanations.

### Stories

- As a user, I can see technical SEO issues with evidence and suggested remedies.
- As the recommendation engine, I receive normalized issue candidates, not raw strings.

### Tasks

- Implement audit rule contract.
- Add metadata checks.
- Add indexability checks.
- Add canonical checks.
- Add internal-link checks.
- Add schema presence checks.
- Add issue grouping.

## EPIC TSEO-002: AI Bot Accessibility Audit

### Goal

Detect whether content is accessible to AI/search crawlers where ethically and technically measurable.

### Stories

- As a user, I can see whether robots rules or site setup may block discovery.
- As the system, I avoid claiming guaranteed AI citation benefits.

### Tasks

- Inspect robots.txt.
- Inspect sitemap.
- Identify crawl blocks.
- Identify noindex/nofollow conflicts.
- Add AI crawler user-agent policy notes where available.
- Add caveat labels.

---

# Epic Cluster 5: Search and Prompt Demand Intelligence

## EPIC SEARCH-001: Search-Backed Prompt and Topic Discovery

### Goal

Generate prompt/topic opportunities from real demand signals where available.

### Stories

- As a user, I can see prompts and topics mapped to business services and audiences.
- As the system, I distinguish real provider data from simulated demand.

### Tasks

- Create prompt/topic provider contract.
- Add demo provider.
- Add Search Console adapter placeholder.
- Add keyword/SERP provider placeholder.
- Add source and estimate labels.
- Add demand proxy model.

## EPIC SEARCH-002: Intent, Funnel, and Topic Cluster Engine

### Goal

Group opportunities by buyer intent and business value.

### Stories

- As a user, I can see whether an opportunity is informational, commercial, transactional, local, comparison, or navigational.
- As the system, I can map topics to funnel stage and recommended content type.

### Tasks

- Implement intent classifier.
- Implement funnel-stage classifier.
- Implement topic clustering.
- Allow user correction.
- Store confidence and evidence.

---

# Epic Cluster 6: AI Visibility Engine

## EPIC AIV-001: Prompt Family and Variant System

### Goal

Track AI visibility using controlled prompt families, not random one-off prompts.

### Stories

- As a user, I can define important buyer questions.
- As the system, I generate controlled variants by geography, persona, specificity, buying stage, and wording.
- As the analytics layer, I aggregate observations under prompt families.

### Tasks

- Create prompt family schema.
- Create prompt variant schema.
- Add prompt type enum.
- Add geography/persona/buying-stage fields.
- Seed Northstar prompt families.

## EPIC AIV-002: Timestamped AI Observation Runner

### Goal

Store AI answers as observations with sample size and uncertainty.

### Stories

- As a user, I can run mock AI visibility checks.
- As the system, I store every answer with timestamp, platform, prompt, and raw response.
- As the product, I never present one answer as a stable ranking.

### Tasks

- Create observation run model.
- Create deterministic mock provider.
- Store raw answer and metadata.
- Add status, errors, and cost metadata fields.
- Add tests for reproducible variation.

## EPIC AIV-003: Mention, Sentiment, and Variability Metrics

### Goal

Extract brand/competitor mentions and quantify uncertainty.

### Stories

- As a user, I can see mention rate, competitor rate, sentiment distribution, and sample size.
- As the system, I show low confidence when sample size is insufficient.

### Tasks

- Implement mention extractor.
- Implement competitor mention extractor.
- Implement sentiment classifier.
- Calculate sample size and variance.
- Add UI labels and tests.

---

# Epic Cluster 7: Citation and Source Intelligence

## EPIC CITE-001: Citation Extraction and Domain Intelligence

### Goal

Extract and normalize cited URLs and domains from AI observations.

### Stories

- As a user, I can see which pages and domains AI answers cite.
- As the system, I distinguish first-party, competitor, and third-party citations.

### Tasks

- Implement citation extractor.
- Normalize URLs and domains.
- Classify first-party vs competitor vs third-party.
- Link citations to prompt, platform, and answer.
- Aggregate by domain and page.

## EPIC CITE-002: Citation Gap to Action

### Goal

Turn citation evidence into ethical content/source recommendations.

### Stories

- As a user, I can see where competitors are cited but my site is absent.
- As the system, I only create citation gaps when sample size supports the conclusion.
- As the content engine, I receive brief requirements from citation gaps.

### Tasks

- Implement sample-size threshold.
- Detect competitor-cited/user-absent gaps.
- Detect missing first-party source pages.
- Create recommendation candidate.
- Add tests preventing weak-evidence citation gaps.

---

# Epic Cluster 8: Content Inventory and Content Intelligence

## EPIC CONTENT-001: GSC-Ready Content Inventory

### Goal

Create a content inventory that can work with mock data now and GSC later.

### Stories

- As a user, I can see pages, target query, page purpose, performance, content status, and opportunity.
- As the system, I can connect content inventory to recommendations and outcomes.

### Tasks

- Create content inventory model.
- Add target query mapping.
- Add page purpose.
- Add simulated impressions, clicks, position, and SEO value.
- Add source labels.
- Add monthly re-evaluation placeholder.

## EPIC CONTENT-002: Content Quality and Refresh Engine

### Goal

Detect content decay, weak coverage, missing proof, and conversion clarity issues.

### Stories

- As a user, I can see which pages need updates and why.
- As the system, I can identify missing entities, weak proof, stale content, unclear CTAs, and duplicate coverage.

### Tasks

- Implement entity/topic coverage check.
- Implement freshness signal.
- Implement trust/proof check.
- Implement CTA clarity check.
- Create refresh recommendation candidate.

---

# Epic Cluster 9: Competitor Intelligence

## EPIC COMP-001: Competitor Type and Coverage Model

### Goal

Separate business, organic, local, AI-answer, and citation competitors.

### Stories

- As a user, I can correct competitor type and relevance.
- As the system, I do not mix competitor categories in scoring.

### Tasks

- Create competitor type enum.
- Add source and confidence.
- Add user correction flow.
- Compare service/page coverage.

## EPIC COMP-002: Competitor Prompt and Citation Gap Analysis

### Goal

Show where competitors are mentioned or cited and the user is absent.

### Stories

- As a user, I can see competitor visibility gaps by prompt family and cited source.
- As the recommendation engine, I can create action candidates from competitor gaps.

### Tasks

- Aggregate competitor mentions.
- Aggregate competitor citations.
- Compare against user mentions/citations.
- Require sample-size threshold.
- Emit recommendation candidates.

---

# Epic Cluster 10: Recommendation Intelligence

## EPIC REC-001: Unified Recommendation Candidate Bus

### Goal

Allow every engine to emit comparable recommendation candidates.

### Stories

- As an engine, I can submit candidates with evidence and score inputs.
- As the recommendation engine, I can rank technical, search, AI visibility, citation, content, and competitor opportunities together.

### Tasks

- Define candidate schema.
- Add source engine enum.
- Add evidence chain.
- Add score component fields.
- Add validation.

## EPIC REC-002: Transparent Next-Best-Action Ranking

### Goal

Rank actions by business value, evidence strength, impact, effort, risk, urgency, and measurement readiness.

### Stories

- As a user, I can see why one action is recommended first.
- As the system, I can explain score components without pretending scientific certainty.

### Tasks

- Implement scoring formula.
- Store score components.
- Add explanation generator.
- Add dependency and conflict handling.
- Add grouping: critical, high impact, quick win, strategic bet, monitor, ignore.

---

# Epic Cluster 11: Content Generation and Human Review

## EPIC GEN-001: Evidence-Grounded Brief Builder

### Goal

Generate content briefs from evidence, not generic prompts.

### Stories

- As a user, I can generate a brief from a recommendation.
- As the system, the brief includes objective, audience, intent, evidence, proof requirements, internal links, CTA, and measurement plan.

### Tasks

- Create brief model.
- Build brief from recommendation evidence.
- Add content type variants: service, local, comparison, FAQ, how-to, article.
- Add claims requiring verification.

## EPIC GEN-002: Draft Generation with Claim Safety

### Goal

Generate editable assets without fabricating authority.

### Stories

- As a user, I can generate metadata, page copy, FAQ, schema proposal, social copy, or email from a brief.
- As the system, unsupported claims are flagged and external publishing requires approval.

### Tasks

- Create mock AI provider.
- Add future provider interface.
- Store asset versions.
- Add diff view.
- Add approval state.
- Add claim validation.

---

# Epic Cluster 12: Orchestration, Reports, and Learning

## EPIC ORCH-001: Recommendation-to-Campaign Workflow

### Goal

Turn approved recommendations into coordinated campaigns.

### Stories

- As a user, I can bundle recommendations into a campaign with tasks and assets.
- As the system, I can track approvals, UTM plan, schedule, and measurement.

### Tasks

- Create campaign model.
- Add tasks and owners.
- Add approval gates.
- Add UTM plan.
- Add mock publish/export handoff.

## EPIC LEARN-001: Outcome Measurement and Attribution Caveats

### Goal

Measure what changed without making false causation claims.

### Stories

- As a user, I can see baseline, implementation date, comparison window, observed change, and confidence.
- As the system, I classify outcomes as positive signal, negative signal, no meaningful change, insufficient data, confounded, or awaiting data.

### Tasks

- Create metric snapshot model.
- Create baseline window.
- Create comparison window.
- Add external event annotations.
- Add outcome classification.
- Feed learning into recommendation scoring.

---

# First Ten Implementation Slices

Build these in order unless repository evidence proves a slice is already complete.

1. Unified evidence ledger and evidence drawer.
2. Business knowledge graph and service/audience priorities.
3. Secure single-page crawl and normalized page evidence.
4. Deterministic metadata/indexability audit to evidence-backed recommendation.
5. Transparent next-best-action scoring.
6. Site inventory and page classification.
7. Search-backed prompt/topic opportunity model with demo provider.
8. AI prompt family, mock observation runner, mentions, citations, and variance.
9. Citation gap to content brief.
10. Outcome snapshot and attribution caveat.

## What Not To Build Yet

- Billing
- Plugin marketplace
- Broad integrations
- Decorative dashboards
- Generic chatbot
- Generic AI article writer
- Fake AI visibility score
- Large-scale crawler before single-page safety is proven
- Social scheduling before recommendation quality works

