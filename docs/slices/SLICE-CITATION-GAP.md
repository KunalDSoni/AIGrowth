# SLICE-CITATION-GAP

## Problem

AI visibility observations showed cited domains, but the product did not yet turn citation patterns into a useful action.

## User Outcome

The user sees citation gap actions that explain whether Northstar lacks a first-party cited source, whether competitors are cited, what to improve, what evidence supports the action, and how to measure the follow-up run.

## Existing Reusable Work

- AI visibility prompt families and observations.
- Shared evidence references.
- AI visibility workspace route.

## Scope

- Add a citation gap action model.
- Aggregate cited domains and competitor citation patterns.
- Classify gaps as first-party page, source strengthening, or third-party source.
- Show citation gap actions in the AI visibility workspace.
- Add unit and E2E tests.

## Exclusions

- No live citation fetching or verification.
- No automated outreach.
- No link-building workflow.
- No ranking or citation guarantees.

## Architecture

`lib/engines/citation-gap.ts` consumes AI visibility summaries and observations. It emits `CitationGapAction` records that are rendered on `/demo/ai-visibility`.

## Evidence Design

Each action carries the evidence IDs from the prompt-family observations that created the action.

## Security

No external calls were added. Citation URLs are deterministic demo URLs.

## Tests

- Unit tests verify action creation and suppression when first-party citations are already strong.
- E2E verifies citation gap actions appear on the AI visibility page.

## Acceptance Criteria

- Complete: citation gap actions are generated from AI visibility data.
- Complete: UI shows actions, evidence counts, assumptions and measurement plan.
- Complete: tests and build pass.

## Known Limitations

- Citation gaps use simulated observations.
- Competitor domains are mock domains.
- Third-party source opportunities are classified but not routed into an execution workflow yet.

## Next Logical Slice

Outcome learning: baseline, implementation event, comparison window, observed changes, attribution limitations and follow-up action.
