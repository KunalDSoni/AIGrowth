# SLICE-UNIFIED-GROWTH-INTELLIGENCE

## Problem

The product had strong individual demo engines, but no single layer that synthesized technical, content, AI visibility, citation and outcome signals into ranked decisions.

## User Outcome

The dashboard now exposes cross-engine decisions with priority score, source signals, evidence IDs, next action, measurement guidance and SEO guardrails.

## Scope

- Add `GrowthSignal` and `UnifiedGrowthDecision` domain models.
- Add `buildGrowthSignals` and `buildUnifiedGrowthDecisions`.
- Encode SEO and AI-search guardrails.
- Render top cross-engine decisions on the dashboard.
- Add unit and E2E tests.

## Guardrails Encoded

- Foundational SEO remains relevant.
- Useful, original and non-commodity content is required.
- No keyword stuffing.
- No artificial content length targets.
- No `llms.txt` claims for Google AI visibility.
- No special AI schema claims.
- No ranking, citation, traffic or conversion guarantees.

## Acceptance Criteria

- Complete: unified decisions are generated from multiple engine sources.
- Complete: dashboard shows cross-engine decisions.
- Complete: unsafe AI SEO shortcuts are rejected by tests.
- Complete: tests and build pass.

## Known Limitations

- Signals are still mostly deterministic demo signals.
- No learning model or persistent weighting yet.
- Real provider data will improve evidence strength and ranking.

## Next Logical Slice

Durable provider evidence and audit-run persistence.
