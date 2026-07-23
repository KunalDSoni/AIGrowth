# OpenGrowth Industry-Grade Development Prompt

Use this prompt in the actual product repository before the next development run.

## Mission

You are building OpenGrowth Engine: an AI-native SEO, GEO, AEO, content intelligence, citation intelligence, and marketing decision engine.

The product must compete with the direction of Semrush, Ahrefs, Surfer, Profound, Peec AI, HubSpot, and the emerging AI visibility category. It must not become a generic SaaS dashboard, generic AI writer, or shallow website audit tool.

Before planning implementation, read these blueprint files in order:

1. `README.md`
2. `00-governance/CRITICAL_PRE_DEVELOPMENT_ADDENDUM.md`
3. `00-governance/COMPETITIVE_SERVICE_MAP.md`
4. `00-governance/V2_INDUSTRY_GRADE_EPICS.md`
5. `00-governance/90_DAY_ENGINE_ROADMAP.md`
6. `00-governance/EVIDENCE_CONTRACT.md`

The core product is:

```text
Business context
+ website evidence
+ technical SEO evidence
+ search intent evidence
+ AI-answer observations
+ citation/source evidence
+ competitor evidence
+ outcome evidence
→ transparent next-best actions
→ generated work
→ approval
→ measurement
→ learning
```

The next development run must build one excellent vertical slice, not a wide set of weak pages.

---

# 1. Strategic Reality

The strongest competitors are moving in these directions:

- Ahrefs Brand Radar: search-backed prompt databases, AI visibility, mentions, citations, competitor share of voice, source tracking, Reddit, YouTube, TikTok, and custom prompt monitoring.
- Semrush AI Visibility: AI visibility baseline, competitor benchmarking, prompt databases, topic gaps, cited pages, regional breakdowns, and integration with traditional SEO workflows.
- Surfer and content intelligence tools: prioritized action lists, content audits, topical maps, optimization, internal links, and execution.
- HubSpot and marketing suites: CRM-connected execution, campaigns, automation, reporting, and attribution.

OpenGrowth should not try to beat Ahrefs or Semrush by inventing a giant web index immediately.

OpenGrowth should beat them on:

1. Evidence transparency.
2. Business-context prioritization.
3. AI visibility uncertainty handling.
4. Citation-to-action intelligence.
5. Human-in-the-loop execution.
6. Measurement and learning.
7. Accessibility for small businesses and freelancers.

---

# 2. Non-Negotiable Product Thesis

Every recommendation must be a business decision, not a dressed-up issue.

Bad:

> Missing meta description.

Good:

> Rewrite the homepage title and description because the page targets high-value bookkeeping services but does not clearly communicate Australia, outsourced accounting, or consultation intent. This is a quick win with low effort, directly supports the primary conversion goal, and can be measured through search impressions, CTR, and consultation CTA clicks.

Every recommendation must contain:

- Action
- Business reason
- Evidence
- Assumptions
- Confidence
- Effort
- Risk
- Expected impact
- Completion definition
- Measurement plan
- Source engines
- Data labels

---

# 3. Before Coding: Inspect Existing Repository

Do not start by creating files blindly.

First inspect:

- Framework and routes
- Package scripts
- Database schema and migrations
- Existing models
- Existing seed data
- Existing audit logic
- Existing recommendation logic
- Existing AI or mock providers
- Existing tests
- Existing documentation
- Broken, duplicated, or UI-only code

Then create or update:

- `docs/CAPABILITY_REGISTRY.md`
- `docs/AI_SEO_ENGINE_READINESS.md`
- `docs/PRIORITY_BACKLOG.md`
- `docs/NEXT_VERTICAL_SLICE.md`

Classify capabilities as:

- `COMPLETE`
- `FUNCTIONAL_BUT_INCOMPLETE`
- `UI_ONLY`
- `MOCK_ONLY`
- `PARTIALLY_IMPLEMENTED`
- `BROKEN`
- `DUPLICATED`
- `NOT_STARTED`
- `NOT_CURRENTLY_REQUIRED`

Do not rebuild working code.

---

# 4. Build Only One Vertical Slice

Select the highest-value missing P0 slice based on repository readiness.

Default slice:

```text
Business profile
→ normalized page evidence
→ deterministic SEO observation
→ evidence reference
→ recommendation candidate
→ transparent recommendation score
→ recommendation detail UI/API
→ user status update
→ tests
```

If the repository already has this, choose the next slice:

```text
Prompt family
→ controlled prompt variants
→ deterministic mock AI observations
→ brand/competitor mention extraction
→ citation extraction
→ sample size and variability metrics
→ AI visibility evidence UI
→ one evidence-backed recommendation
→ tests
```

If that also exists, choose:

```text
AI observation citations
→ cited domain aggregation
→ first-party vs competitor citation gap
→ content/source recommendation
→ evidence-backed brief
→ tests
```

Do not build a landing page, billing, broad integrations, plugin marketplace, or decorative charts unless the selected slice genuinely requires it.

---

# 5. Evidence Model

Implement or adapt a shared evidence contract.

Required evidence fields:

- `id`
- `organizationId`
- `projectId`
- `kind`
- `source`
- `sourceRecordId`
- `observedAt`
- `retrievedAt`
- `validUntil`
- `reliability`
- `isEstimated`
- `isSimulated`
- `isUserSupplied`
- `isAiInferred`
- `summary`
- `normalizedValue`
- `metadata`

Evidence kinds:

- `CRAWL_OBSERVATION`
- `TECHNICAL_SEO_OBSERVATION`
- `SEARCH_CONSOLE_METRIC`
- `ANALYTICS_METRIC`
- `KEYWORD_PROVIDER_ESTIMATE`
- `SERP_OBSERVATION`
- `AI_ANSWER_OBSERVATION`
- `CITATION_OBSERVATION`
- `COMPETITOR_OBSERVATION`
- `CONTENT_ANALYSIS`
- `USER_SUPPLIED`
- `AI_INFERENCE`
- `CALCULATED`
- `SIMULATED`

UI must label:

- Observed
- Estimated
- Simulated
- AI inferred
- User supplied
- Stale
- Insufficient evidence

---

# 6. Recommendation Scoring

Use transparent score components.

Suggested normalized formula:

```text
Impact Score =
0.30 × business_relevance
+ 0.20 × conversion_potential
+ 0.15 × discovery_opportunity
+ 0.15 × severity
+ 0.10 × strategic_alignment
+ 0.10 × urgency

Feasibility Score =
0.40 × inverse_effort
+ 0.30 × evidence_confidence
+ 0.20 × inverse_risk
+ 0.10 × dependency_readiness

Priority Score =
100 × Impact Score × Feasibility Score
```

This is decision support, not scientific truth.

Store individual score components and show the score explanation.

---

# 7. AI Visibility Methodology

AI visibility is not ranking.

Every AI result is a timestamped observation.

Required concepts:

- Prompt family
- Prompt variant
- Platform
- Locale
- Observation run
- Raw answer
- Brand mentions
- Competitor mentions
- Citations
- Cited URLs
- Cited domains
- Sentiment
- Prominence
- Sample size
- Run-to-run variability
- Extraction confidence

Prompt families should combine:

- Behavioral relevance: real customer questions, Search Console queries, People Also Ask-style questions, sales calls, support tickets, forums, Reddit, Quora, and customer language.
- Semantic coverage: category prompts, comparison prompts, alternative prompts, local prompts, buying-stage prompts, product/service prompts, and problem-solution prompts.

Never show one magic AI visibility score without sample size and evidence.

---

# 8. Citation Intelligence

Citation intelligence must answer:

- Which pages are cited?
- Which domains are cited repeatedly?
- Is the user’s domain cited?
- Are competitors cited?
- Are third-party sources dominating?
- Which source types matter?
- Which first-party page should be improved?
- Which third-party presence gap is ethical and useful?

Do not recommend spam outreach, fake authority, fake reviews, fabricated PR, or manipulative citation schemes.

---

# 9. Content Generation Rules

Content generation is not the product. Evidence-grounded execution is the product.

Generated content must:

- Come from a brief.
- Link to evidence.
- Respect business context.
- Match search intent.
- Identify claims requiring verification.
- Avoid fabricated numbers, awards, reviews, credentials, quotes, case studies, and statistics.
- Avoid keyword stuffing.
- Avoid arbitrary word count targets.
- Include measurement plan.
- Require approval before publishing/exporting.

---

# 10. Google and SEO Guardrails

Follow these rules:

- Foundational SEO remains relevant for Google AI features.
- Crawlability, indexability, helpful content, structured data accuracy, and user value matter.
- Do not claim special AI schema is required for Google AI visibility.
- Do not claim `llms.txt` guarantees AI visibility.
- Do not claim content must be artificially chunked for Google AI search.
- Do not guarantee rankings, citations, traffic, conversions, or revenue.
- Do not imply access to internal Google ranking systems.

---

# 11. Security Requirements

If crawling exists or is added:

- Allow only HTTP and HTTPS.
- Block private IPs, loopback, link-local, cloud metadata, and reserved ranges.
- Revalidate redirects.
- Enforce timeout.
- Enforce response size limits.
- Enforce content type limits.
- Do not execute page scripts in the basic crawler.
- Treat crawled content as untrusted.
- Sanitize rendered content.
- Prevent prompt injection from crawled pages.

---

# 12. Evaluation Harness

Add tests that prove intelligence quality.

Required tests for the selected slice:

- Evidence is created with correct kind and provenance.
- Recommendation cannot exist without evidence.
- Score explanation matches stored score components.
- Business priority changes recommendation ranking.
- Simulated data is labelled.
- AI visibility metrics expose sample size.
- Citation gap is not created from insufficient sample size.
- Generated content flags unsupported claims.
- Outcome logic does not imply causality from weak data.

Only implement tests relevant to the selected slice, but design the harness to expand.

---

# 13. Golden Demo Dataset

Use one high-quality demo business.

Business:

Northstar Accounting

Market:

Australia

Goal:

Qualified consultation bookings.

Services:

- Bookkeeping
- Payroll
- Virtual CFO
- Tax preparation
- Outsourced accounting
- Accounts payable
- Accounts receivable
- Financial reporting

Segments:

- Medical clinics
- E-commerce businesses
- Professional services
- Growing small businesses

Seed enough data to show:

- Existing pages
- Missing service/audience pages
- Technical issues
- Search opportunities
- AI prompt families
- AI observations
- Citations
- Competitors
- Recommendations
- Generated assets
- Outcomes

Label every simulated value.

---

# 14. Definition of Done

The selected slice is done only when:

- It creates a meaningful user-visible outcome.
- Data is persistent where needed.
- Evidence/provenance exists.
- Recommendation or conclusion is explainable.
- Authorization is enforced where relevant.
- Loading, empty, and error states exist where UI is added.
- Unit tests pass.
- Integration tests pass where relevant.
- E2E path exists where practical.
- Type check passes.
- Lint passes.
- Production build passes.
- Documentation reflects reality.
- Known limitations are honest.

---

# 15. Completion Report

Return:

- Repository state
- Slice selected
- Why it was selected
- User outcome
- Architecture changes
- Data model changes
- Evidence model used
- Tests added
- Validation results
- Known limitations
- Next recommended slice

Stop after one slice.

Do not automatically start the next epic.
