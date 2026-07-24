# Proprietary Research Engine — manufacture citable facts (Frontier 3)

**Date:** 2026-07-24
**Status:** Design — approved for planning
**Frontier:** 3 of 4 (industry-whitespace series)
**Slug:** proprietary-research-engine

## Problem

In the GEO era the scarcest, most valuable marketing asset is not content — it is
**primary data**. LLMs, journalists, and analysts do not cite the 10,000th
"ultimate guide"; they cite the source of a *number*. "According to [Brand]'s 2026
survey of 4,000 freelancers…" is a permanent, compounding citation magnet pulled
into AI answers, quoted in articles, and linked from real domains. Almost nobody
below the enterprise/agency tier produces original research — it is slow,
expensive, and needs a data team.

## Thesis

A machine that **manufactures original, defensible research studies** from
ethically-sourced data — turning "we have nothing to cite" into "we are *the*
citable source in our niche." The ultimate anti-slop play: while the web drowns in
AI filler, this produces the genuinely scarce thing — **new facts**. It is the
fuel for Frontier 4 (entity/GEO) and the natural evolution of the GEO lead.

## Decision: data source

**Public-data synthesis is the v1 engine, with a first-party data slot as a
first-class plug-in; the survey engine is deferred.** Rationale: the survey engine
has the hardest external dependency (distribution path + panel cost + weeks of
fielding); first-party studies require the account to already have clean data,
which many will not on day one. Public-data synthesis works for **every** account
immediately and reuses the Common Crawl / OpenSearch / ingestion stack already
built (commits 2272c4f, 64eb63c). Accounts with proprietary data get exclusive,
un-replicable studies through the first-party slot.

## Architecture

```
Angle Finder          Data Sourcer         Integrity        Study Composer
────────────          ────────────         ─────────        ──────────────
citation gaps ──▶ ┌─ public datasets ─┐   Methodology     ┌─ headline stat
"who asks X but    │  (Common Crawl,   │──▶ Guard  ──▶ Analysis ─▶├─ findings + charts
 no source         │   open/gov data)  │   (pre-reg,      Engine   ├─ methodology appendix
 answers?"         └─ first-party slot ┘   n-checks,    (stats+CI)  ├─ Dataset schema markup
                       (anonymized)         provenance)              └─ HUMAN APPROVAL → publish
                                                                            │
                                                     Frontier 4 (entity/GEO) ◀┘ + Outreach CRM pitch
```

## Components (each independently testable)

### Angle Finder
Finds citable questions — niche gaps where "a number would get cited but no source
answers it" — using the GEO prompt-universe plus existing why-not-cited / citation-
gap analysis. Output: study angles ranked by citation potential.

### Data Sourcer
Pulls ethically-sourced public datasets via the existing ingestion stack, plus an
optional first-party ingest slot (anonymized/aggregated). Records source + license
+ provenance for every dataset; refuses unlicensed or uncertain sources.

### Methodology Guard (integrity core, make-or-break)
Defines method *before* results (pre-registration style), runs sample-size and
representativeness checks, and flags when the data cannot support the intended
claim. Emits a plain-English methodology statement.

### Analysis Engine
Computes findings (trends, segments, correlations) with confidence intervals;
every stat carries n, source, and method.

### Study Composer
Packages a citable asset: headline stat, key findings, charts (per dataviz
standards), methodology appendix, and `schema.org/Dataset` markup so machines
index it as a data source. **Human-approved before publish — never auto-publish.**

### Distribution Hooks
Feeds Frontier 4's entity work so LLMs pick the study up as an entity fact, and
generates a journalist pitch routed through the existing Outreach CRM.

## Integrity layer (existential non-negotiable)

A fabricated or underpowered statistic is reputational poison that LLMs amplify.
Every number traces to source + method; thin data → "Directional" or "Insufficient
— we won't publish this claim"; the engine refuses to ship a stat it cannot
defend. The "no fake scores" rule at maximum stakes.

## Why it is a moat

While the web drowns in AI slop, this manufactures new, defensible facts. Each
published study is a permanent citation magnet compounding across AI answers,
articles, and backlinks — and the fuel Frontier 4 needs to make models cite you.

## Error handling

- No credible data for an angle → drop the angle, do not manufacture a finding.
- License unclear on a dataset → exclude it, log why.
- Result contradicts the pre-registered hypothesis → report it honestly (often the
  more citable finding); never p-hack toward a nicer number.

## Testing

- Methodology Guard: fixture datasets with known n/bias → assert it flags
  underpowered/unrepresentative cases and blocks the claim.
- Analysis Engine: inject data with a known trend → assert recovered stat + CI.
- Composer: assert every rendered stat carries n/source/method and valid Dataset
  markup; assert publish is gated on approval.

## Scope (v1, YAGNI)

**In:** Angle Finder, Data Sourcer (public via existing stack + first-party slot),
Methodology Guard, Analysis Engine, Study Composer with schema markup + human-gated
publish, one distribution hook into Frontier 4.

**Deferred:** survey/panel fielding engine, automated journalist outreach
sequences (reuse existing CRM manually first), interactive data microsites.

## Fit with product non-negotiables

No fabricated stats · transparent methodology · human-approved publish · estimates
labelled · thin data → "insufficient/directional," never spun.
