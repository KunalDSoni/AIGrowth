# Causal Truth Engine — "Did-It-Actually-Work" (Frontier 1)

**Date:** 2026-07-24
**Status:** Design — approved for planning
**Frontier:** 1 of 4 (industry-whitespace series)
**Slug:** causal-truth-engine

## Problem

Marketing measurement is bankrupt below the enterprise tier. Third-party cookies
are dead, GA4's data-driven attribution is an untrusted black box, and AI answer
engines are eating the click so last-touch increasingly credits nothing. Every
tool in the competitive set still sells **attribution** — a correlational story
about which touchpoint "gets credit." Almost no one answers the truth question:
*would this outcome have happened anyway?* That requires **experiments**, and
experiments are treated as too hard for a founder or a 2-person agency.

## Thesis

Promote **causal lift** from a feature to the **substrate** — the default way
every recommendation is scored, proven, and reweighted. Not "we think this
helped," but "we ran a holdout; measured lift is +14% ±5%, confidence: High."
This is the "estimates stay estimates / did it work" non-negotiable turned into a
product category. Scope is **cross-channel including paid**, because on/off geo
tests on paid spend are clean and fast, and it lets OpenGrowth graduate from SEO
advisor to a system that proves ROI and (with human approval) reallocates budget.

## Architecture

```
Interventions          Outcomes                 Truth Engine
─────────────          ─────────                ────────────
paid toggle ─┐         conversions ─┐           ┌─ Feasibility/Power precheck
content pub ─┼─▶ Intervention   revenue ─┼─▶ Outcome  ─┤   (min detectable effect, duration)
email send ─┤    Ledger         signups ─┤    Streams  ├─ Truth-Ladder Designer (picks test)
GEO fix    ─┘   (what/when/     GSC/GA4 ─┘             ├─ Lift Estimator (point + CI + label)
                 where/who)                            └─ Budget Governor (proposes, never moves)
                                                                │
                                                    Learn loop ◀┘  (causal priors reweight NBAs)
```

## Components (each independently testable)

### Intervention Ledger
Records every marketing change as a timestamped, geo/audience-scoped event with
metadata (channel, spend delta, creative, hypothesis, owner). The join spine.

### Outcome Streams
Normalized time series of business outcomes per geo/segment, from existing
GSC/GA4 connectors plus a conversions/revenue adapter. Handles gaps and lag
explicitly (never silently interpolates to fake precision).

### Feasibility / Power precheck
Before a test runs, computes the minimum detectable effect given the account's
traffic/budget and a target window, and states it plainly: "with your volume, the
smallest lift we can detect in 21 days is ±18% — proceed, extend, or concentrate
budget?" Prevents underpowered theater.

### Truth-Ladder Designer (novel core)
Given the intervention plus account constraints, selects the strongest feasible
design and its confidence tier. Climbs to the highest rung the data supports:

| Rung | Design | Needs | Confidence label |
|---|---|---|---|
| 1 | Geo-holdout (matched treat/control markets) | multi-market footprint | **High — causal** |
| 2 | Time-based on/off pulsing (budget/PSA pulse) | single market, decent volume | **Good — causal, temporal** |
| 3 | Switchback (alternating on/off blocks) | fast-cycling channel | **Good — causal, temporal** |
| 4 | Synthetic control / CausalImpact (weighted counterfactual) | history + covariates | **Directional — modeled** |
| 5 | Observational only | nothing testable | **Insufficient — say so** |

Every result inherits its rung's honesty label. "Insufficient" is a first-class
result, not a failure to hide.

### Lift Estimator
After the window, returns point estimate, confidence interval, and honest label
using the design's estimator (diff-in-diff for geo-holdout; Bayesian structural
time series / CausalImpact for synthetic control; etc.).

### Budget Governor (autonomous-CMO restraint)
Converts each channel's **measured incremental** ROAS/CAC (never blended or
attribution ROAS) into a reallocation proposal with diff, confidence, and
downside. Renders it, then **stops for human approval**. May stage the change as
a channel draft; never pushes spend live alone — the "never publishes alone" rule
extended to money.

### Learn-loop integration
Measured lifts overwrite correlational priors in the Next-Best-Action ranker. A
tactic that looked great by attribution but tested flat is down-weighted with
evidence. Each account accrues a private "what causally worked here" library.
(Opt-in privacy-safe federated vertical benchmarks: deferred, potential moat.)

## Error handling & non-negotiables

- Underpowered test → refuse to declare a winner; surface the precheck warning.
- Contaminated control (spillover detected) → flag, downgrade label, never
  silently report.
- Missing/late outcome data → widen the interval, never narrow to fake precision.
- Every number carries its rung label. No fake scores; estimates labelled as
  estimates; money never moves without approval.

## Testing

- Synthetic ground-truth generator: inject a known lift into simulated series,
  assert the estimator recovers it within CI.
- Power-calc unit tests; adapter contract tests.
- Golden-path integration: seed intervention → simulate outcomes → run designer →
  assert correct rung + honest label.

## Scope (v1, YAGNI)

**In:** Intervention Ledger, Outcome Streams (reuse GSC/GA4 + one conversions
adapter), Feasibility precheck, Truth-Ladder rungs 1–2 + synthetic-control (rung
4), one paid adapter (Google Ads), Lift Estimator, Budget Governor as
**proposal-only**, Learn-loop reweighting.

**Deferred:** Switchback (rung 3), full Bayesian MMM layer, federated
cross-tenant benchmarks, additional paid adapters (Meta, etc.), autonomous spend
moves (never in scope without explicit future decision).

## Fit with product non-negotiables

No fake "rank #1" scores · no auto-publish/auto-spend · weak evidence →
"insufficient/directional" · estimates labelled as estimates · human approval
gates on every money and publish action.
