# SLICE-AI-VISIBILITY

## Problem

The product had no AI-search visibility capability. It could not observe whether AI answers mention Northstar, cite Northstar, cite competitors, or vary across prompt families.

## User Outcome

The user can open an AI visibility workspace and see timestamped simulated observations grouped by prompt family, with sample size, brand mention frequency, competitor mentions, cited domains, citation stability, answer consistency, and raw observation evidence.

## Existing Reusable Work

- Shared evidence contract.
- Demo project and competitor data.
- Workspace navigation and design system.
- Test infrastructure.

## Scope

- Add prompt family and observation domain types.
- Add deterministic mock observation generation.
- Summarize mentions, competitors, cited domains, consistency, and stability.
- Add evidence records for observations.
- Add an AI visibility workspace page.
- Add Prisma schema models for future persistence.
- Add unit and E2E tests.

## Exclusions

- No real model/API calls.
- No live web citation verification.
- No ranking claims.
- No scheduling or trend history.
- No citation gap recommendation yet.

## Architecture

`lib/engines/ai-visibility.ts` creates deterministic mock observations from controlled prompt families and summarizes them. `lib/data/demo.ts` exports observations, summaries, and evidence records. `app/demo/ai-visibility/page.tsx` renders the workspace.

## Evidence Design

Every observation maps to an `EvidenceReference` with kind `AI_ANSWER_OBSERVATION`, low reliability, simulated and estimated flags, source, timestamp, and normalized observation payload.

## Security

No external model or web calls are made. Raw responses are deterministic strings rendered as React text.

## Telemetry

No new event was added in this slice. Future work should track observation workspace views and prompt-family expansion.

## Tests

- Unit tests verify deterministic observation count, summary sample size, citation counts, and competitor counts.
- E2E verifies the AI visibility page renders sample size, brand mention frequency, and observation details.

## Acceptance Criteria

- Complete: prompt families and observations exist.
- Complete: summaries expose sample size and variability.
- Complete: observations are clearly simulated and not treated as rankings.
- Complete: UI displays raw observation evidence.
- Complete: tests and build pass.

## Known Limitations

- Observations are deterministic demo data.
- No repeated scheduled runs.
- No provider costs or token metadata.
- Citations are not fetched or verified.

## Next Logical Slice

Citation gap to content action: aggregate AI visibility citations and propose first-party or third-party source work.
