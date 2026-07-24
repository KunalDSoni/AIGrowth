# Machine Legibility Engine — shape what the machines perceive (Frontier 4)

**Date:** 2026-07-24
**Status:** Design — approved for planning
**Frontier:** 4 of 4 (industry-whitespace series)
**Slug:** machine-legibility-engine

## Problem

Today's GEO work — and every GEO tool's — is a **thermometer**: it measures
whether ChatGPT, Perplexity, and Gemini mention you. But measuring the temperature
does not cure the fever. Meanwhile shopping is moving into AI agents (ChatGPT
checkout, agentic browsers, comparison agents); a product that is not
machine-legible simply gets skipped by the buying agent. The machine is the new
customer, and no one systematically helps the little guy be *understood* by it.

## Thesis

Turn from **measurement to control**: a single **Machine Legibility Engine** that
scores and fixes how every machine perceives the brand — answer-engines and
shopping-agents alike — off one shared entity core. "We make you legible to the
machines that now decide what humans see and buy." Chosen shape: **both moves, one
surface**, sharing the structured-data/entity spine.

### The honesty tension (ethos as moat)
Shaping what models say must never become manipulation or fabrication. You correct
the record with **true, sourced** facts — never plant flattering falsehoods (models
cross-check and will burn you). This constraint is the differentiator.

## The core idea

Everything hangs on one diff: **what the machines currently believe about you** vs
**the verified truth**. Measure the gap, propose true+sourced corrections, get
human approval, re-measure.

```
                 ┌──────────────── SHARED CORE ────────────────┐
   probes ─▶ Entity Graph Builder   ⟷   Ground Truth Registry
   (LLMs,   "what machines believe"     "verified facts + provenance"
    panels,            │                          │
    Wikidata,          └────────▶ Gap Finder ◀────┘
    schema,                    (belief vs truth, ranked by impact)
    reviews,                          │
    Reddit)          ┌────────────────┴────────────────┐
                     ▼                                  ▼
        Answer-Engine lens                   Shopping-Agent lens
   (how LLMs describe/cite you)      (is your product machine-buyable?)
                     │                                  │
                     └──────────▶ Correction Playbook ◀─┘
                        (human-gated, TRUE+sourced only)
                                    │
                     Legibility Score + Re-probe (before/after)
```

## Components (each independently testable)

### Entity Graph Builder
Assembles the machine's mental model of the brand from LLM probes (reuse the GEO
stack), knowledge panels, Wikidata, on-site schema, review sites, Reddit. Output:
structured "who the machines think you are."

### Ground Truth Registry
The account's human-verified facts (category, offerings, specs, price, service
areas, differentiators) with provenance. Source of truth to diff against.

### Gap Finder
The payload: "model believes X, truth is Y," "missing fact Z," "price outdated,"
"absent where buyers ask." Ranked by commercial impact.

### Answer-Engine lens
How LLMs describe, mention, and cite the brand; feeds corrections on structured
data, Wikidata/Wikipedia accuracy, review/Reddit presence, and primary-source
facts (fuel from Frontier 3).

### Shopping-Agent lens
Is the product machine-buyable? Feed/schema audit, an agent-readability score, and
structured spec/price/availability — including MCP-style product-endpoint
readiness so buying agents can consume it.

### Correction Playbook (human-gated)
Proposes concrete, sourced actions per gap; drafts structured data / suggested
edits. **Never auto-edits third-party properties** — it prepares, a human approves
and submits.

### Legibility Score + Re-probe
One score for how accurately and favorably machines perceive the brand across both
lenses; re-measures after corrections and shows the movement (honest before/after,
borrowing Frontier 1's causal discipline where a clean test is possible).

## Integrity guard (non-negotiable)

Every correction must be true and source-backed; the engine refuses to propose an
unsupported claim and clearly marks "we can suggest this edit, but the third-party
platform decides." No manipulation, no auto-edits, human approval on everything
outward-facing.

## Error handling

- Machine belief unverifiable against truth → mark "unconfirmed," do not force a
  correction.
- Ground-truth fact lacks a source → cannot be used in a public correction; prompt
  to substantiate (loops to Frontier 3).
- Third-party platform rejects an edit → surface honestly; never claim a fix
  landed that did not.

## Testing

- Gap Finder: fixture with known belief/truth mismatches → assert correct,
  impact-ranked gaps.
- Integrity guard: attempt an unsourced flattering correction → assert refusal.
- Shopping lens: fixture product feed → assert agent-readability score +
  missing-field detection.
- Re-probe: seed a correction + simulated post-probe → assert honest before/after
  movement.

## Scope (v1, YAGNI)

**In:** Entity Graph Builder, Ground Truth Registry, Gap Finder, both lenses at
audit-depth, Correction Playbook (draft + human-gated, no auto-submit), Legibility
Score + manual re-probe, Frontier 3 fact-linkage.

**Deferred:** live MCP product-endpoint hosting (audit readiness only in v1),
automated Wikidata/edit submission, continuous re-probe scheduling, marketplace-
specific feed adapters beyond one.

## Fit with product non-negotiables

Truthful, sourced corrections only · no manipulation/fabrication · no auto-edit of
external properties · human approval on all outward actions · honest before/after,
estimates labelled.
