# OpenGrowth Engine Engineering Blueprint

This documentation set defines the engineering backlog for an AI SEO/GEO platform designed around engines, not dashboards.

The product goal is to convert business context, website evidence, search evidence, AI-answer observations, citation gaps, competitor intelligence, and outcome data into prioritized actions that users can understand, approve, execute, and measure.

## Product Principle

The AI SEO/GEO engine is the core product. Landing pages, generic SaaS settings, billing, team management, and broad integrations are support systems. Build them only when they unlock the intelligence loop.

## Core Loop

```text
Understand business
→ Observe website and market
→ Normalize evidence
→ Detect gaps
→ Score opportunities
→ Explain priority
→ Generate proposed work
→ Require approval
→ Measure outcome
→ Learn and reprioritize
```

## Folder Structure

| Folder | Engine |
|---|---|
| `00-governance` | Build rules, milestone plan, evidence contract, release strategy |
| `01-business-understanding` | Business Understanding Engine |
| `02-crawl-engine` | Crawl Engine |
| `03-technical-seo` | Technical SEO Engine |
| `04-search-intelligence` | Search Intelligence Engine |
| `05-content-intelligence` | Content Intelligence Engine |
| `06-ai-visibility` | AI Visibility Engine |
| `07-citation-intelligence` | Citation Intelligence Engine |
| `08-competitor-intelligence` | Competitor Intelligence Engine |
| `09-recommendation-engine` | Recommendation Engine |
| `10-content-generation` | Content Generation Engine |
| `11-marketing-orchestration` | Marketing Orchestration Engine |
| `12-learning-outcomes` | Learning and Outcomes Engine |
| `_templates` | Reusable epic, story, and task templates |

## How Codex Should Use This Blueprint

1. Read `00-governance/BUILD_ORDER.md`.
2. Read `00-governance/CRITICAL_PRE_DEVELOPMENT_ADDENDUM.md`.
3. Read `00-governance/COMPETITIVE_SERVICE_MAP.md`.
4. Read `00-governance/V2_INDUSTRY_GRADE_EPICS.md`.
5. Read `00-governance/90_DAY_ENGINE_ROADMAP.md`.
6. Pick only one engine and one epic at a time.
7. Fill the epic template with repository-specific evidence.
8. Implement one vertical slice with tests.
9. Update the engine backlog and stop before starting another epic.

## Priority Order

1. Evidence and provenance
2. Business understanding
3. Website intelligence
4. Technical SEO diagnosis
5. Search and content opportunity intelligence
6. AI visibility observations with repeated runs
7. Citation and source intelligence
8. Competitor gap intelligence
9. Transparent unified recommendation engine
10. Evidence-grounded content generation
11. Measurement and learning
