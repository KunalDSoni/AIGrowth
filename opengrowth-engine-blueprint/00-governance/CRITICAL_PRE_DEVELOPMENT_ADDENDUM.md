# Critical Pre-Development Addendum

This file must be read before implementation begins.

## Verdict

The blueprint is strong, but it needs a strict methodology layer before development starts. Without it, Codex may build attractive dashboards instead of a real AI SEO/GEO intelligence engine.

## Must-Have Before First Sprint

### 1. Capability Registry

Create `docs/CAPABILITY_REGISTRY.md` in the target repository and classify each capability as `COMPLETE`, `FUNCTIONAL_BUT_INCOMPLETE`, `UI_ONLY`, `MOCK_ONLY`, `PARTIALLY_IMPLEMENTED`, `BROKEN`, `DUPLICATED`, `NOT_STARTED`, or `NOT_CURRENTLY_REQUIRED`.

### 2. Evidence Contract First

Before dashboards or AI generation, implement shared evidence/provenance. Every recommendation must explain source, freshness, reliability, assumptions, and measurement plan.

### 3. Prompt Methodology

AI visibility must use timestamped observations, prompt families, controlled variants, sample size, citations, mentions, sentiment, and variability. Never call one AI response a ranking.

### 4. Golden Demo Dataset

Use Northstar Accounting in Australia with business profile, pages, crawl observations, technical issues, search opportunities, prompt families, AI observations, citations, competitors, recommendations, generated assets, and outcome snapshots.

### 5. Evaluation Harness

Test intelligence quality: evidence correctness, recommendation scoring, AI visibility variance, citation gap thresholds, unsupported claim detection, and outcome attribution limits.

### 6. Anti-Spam Rules

Never recommend fake reviews, fake credentials, fabricated statistics, mass low-value pages, keyword stuffing, hidden text, manipulative links, or unsupported claims about `llms.txt` or special AI schema.

### 7. First Sprint

Build this vertical slice:

```text
Business profile
→ Website/page evidence
→ One deterministic SEO observation
→ Evidence-backed recommendation
→ Score explanation
→ User action status
→ Tests
```

## Stop Rule

Stop if Codex starts rebuilding the landing page, creating many placeholder pages, adding broad integrations, producing generic AI writing, showing AI visibility as one magic score, or creating recommendations without evidence chains.
