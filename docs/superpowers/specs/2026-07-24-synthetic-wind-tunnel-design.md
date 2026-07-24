# Synthetic Wind Tunnel — pre-flight messaging before spend (Frontier 2)

**Date:** 2026-07-24
**Status:** Design — approved for planning
**Frontier:** 2 of 4 (industry-whitespace series)
**Slug:** synthetic-wind-tunnel

## Problem

Every marketing decision is made blind and validated *after* money is spent.
You write positioning, ship a landing page, run ads, then wait weeks for enough
traffic to learn the headline was wrong. LLMs can now impersonate a segment's
reasoning with real fidelity — but ungrounded personas hallucinate agreeable
nonsense, so the naive "AI focus group" is worse than useless.

## Thesis

A **wind tunnel**: before a dollar moves, blow messaging, positioning, offer, and
landing pages past a **panel of AI personas calibrated to the account's real
audience** and watch where they get confused, bored, or objected-out. It is a
**hypothesis generator, not an oracle** — it surfaces what to test and why, ranks
variants, predicts objections — then hands top candidates to Frontier 1's real
experiments for ground truth. **Synthetic explores; causal confirms; calibration
learns.** Grounding in v1 is **real-data calibrated**: personas are built from the
account's own reviews, sales-call notes, tickets, GSC queries, and won/lost
reasons, and each reaction is traceable to real customer voice.

Two design commitments fight the core failure mode (sycophancy):
- **Persona panel**, not one blended "average customer" — preserves objection
  diversity, which is the highest-value output.
- **Forced comparative, justified choices** ("pick the stronger headline and say
  why"), not 1–5 ratings — LLMs rate everything a cheerful 4/5; relative
  judgments cut through that.

## Architecture

```
Real evidence            Personas                 Stimulus            Output
─────────────            ────────                 ────────            ──────
reviews ────┐            ┌─ Persona A (quotes)    headline variants   variant ranking
call notes ─┼─▶ Evidence ├─ Persona B (quotes) ◀─ landing page  ─▶ ┌─ objection map
tickets ────┤   Intake + │  Persona C (quotes)    offer / email      ├─ confusion heatmap
GSC queries ┤   Persona  └─ …                      ad                 ├─ segment deltas
won/lost ───┘   Distiller                          Wind Tunnel Runner └─ SYNTHETIC label + calib %
                                                           │
                                          top variants ────┴──▶ Frontier 1 experiments (confirm)
```

## Components (each independently testable)

### Evidence Intake
Ingests public reviews via the existing Crawlee/Firecrawl stack plus private
uploads (call transcripts, tickets, won/lost notes). Everything is source
material; nothing is invented.

### Persona Distiller
Clusters evidence into grounded personas: jobs-to-be-done, objections, actual
vocabulary, decision criteria, triggers. Each persona is **backed by verbatim
quotes** (provenance), not authored from imagination.

### Wind Tunnel Runner
Runs each stimulus past each persona with **multiple samples** (reusing the GEO
prompt-universe sampling discipline for variance). Captures structured reactions:
comprehension, believability, objections raised, likelihood-to-act, confusion
points, "what would make me act." Uses **forced comparative choice** to fight
agreeableness bias.

### Reaction Aggregator + Objection Map
Ranks variants, surfaces top objections, renders a confusion heatmap over the
landing page, and shows where segments **disagree** (highest-value output).

### Calibration Tracker (credibility engine)
When Frontier-1 experiments resolve, compares synthetic predictions to real lift
and reports the wind tunnel's **historical hit-rate**, so users know exactly how
much to trust it. Without this, it is astrology.

## Honesty layer (non-negotiable fit)

Every screen stamped **"SYNTHETIC — hypothesis, not measurement."** Personas link
to the real quotes grounding them. Predictions are **Directional** until a real
experiment confirms them. A synthetic reaction is never reported as customer data.

## The loop (the moat)

**Synthetic explores → Causal confirms → Calibration learns.** Wind Tunnel ranks
8 headline ideas to 2; Frontier 1 runs the real holdout on those 2; the result
feeds Calibration so next quarter's predictions sharpen and are honestly scored.
No competitor pairs a grounded synthetic panel with a real incrementality engine.

## Error handling

- Thin evidence (< N sources) → fewer personas, wider "confidence unknown" band,
  prompt for more data. Never fabricate a persona from nothing.
- Personas converging to identical reactions → flag low differentiation (usually
  a grounding problem); do not fake diversity.
- Stimulus the personas cannot evaluate (missing context) → say so, do not guess.

## Testing

- Distiller: given a fixture corpus, assert personas carry real quote provenance
  and distinct objection sets.
- Runner: assert forced-choice output is structured and variance is captured
  across samples.
- Calibration: replay known synthetic-prediction/experiment-outcome pairs, assert
  hit-rate math.

## Scope (v1, YAGNI)

**In:** Evidence Intake (reviews + manual upload), Persona Distiller with
provenance, Wind Tunnel Runner for headlines/positioning + one landing page,
Objection Map, SYNTHETIC labeling, Calibration Tracker stub wired to Frontier 1.

**Deferred:** full-page heatmap rendering polish, ad/email/creative stimuli,
auto-ingesting CRM systems, multi-language personas.

## Fit with product non-negotiables

Synthetic clearly labelled and never presented as real data · provenance on every
persona · predictions directional until causally confirmed · pairs with the
human-gated experiment loop rather than replacing it.
