# SLICE-OUTCOME-LEARNING

## Problem

The product could mark actions completed, but it did not compare baseline and post-implementation signals or explain attribution limits.

## User Outcome

The user can open an outcomes workspace and see simulated before-and-after metrics for implemented actions, external events, attribution limitations, confidence, and a follow-up action.

## Existing Reusable Work

- Recommendation measurement plans.
- Demo recommendations.
- Workspace shell and navigation.

## Scope

- Add an outcome learning domain model.
- Add deterministic outcome calculation from baseline and comparison scenarios.
- Add an outcomes workspace route.
- Add Prisma schema alignment for future persistence.
- Add unit and E2E coverage.

## Exclusions

- No real analytics or Search Console integration.
- No causal attribution model.
- No scheduled reporting.

## Architecture

`lib/engines/outcome-learning.ts` transforms implementation scenarios into `OutcomeLearningRecord` objects. `app/demo/outcomes/page.tsx` displays the records.

## Evidence Design

Outcome records explicitly separate baseline period, implementation date, comparison period, observed changes, external events and attribution limitations.

## Security

No external data is fetched. All metrics are deterministic demo records.

## Tests

- Unit tests verify delta calculation and unknown recommendation handling.
- E2E verifies the outcomes page renders attribution and follow-up sections.

## Acceptance Criteria

- Complete: baseline and comparison metrics are shown.
- Complete: observed changes and attribution limits are visible.
- Complete: follow-up action is generated.
- Complete: tests and build pass.

## Known Limitations

- Metrics are simulated.
- No analytics provider is connected.
- Outcome confidence is rule-based, not statistically modeled.

## Next Logical Slice

Real provider adapters and persistence: start with Search Console or safe crawler ingestion.
