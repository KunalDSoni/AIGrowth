# SLICE-TECH-AUDIT-EVIDENCE

## Problem

The audit workspace listed technical issues, but issues were static and did not show the rule or evidence that created them.

## User Outcome

The user can inspect a technical SEO issue and see the deterministic rule, impact area, evidence source, recommended action, and affected page count.

## Existing Reusable Work

- Audit workspace route in `app/demo/audit/page.tsx`.
- Audit issue domain model.
- Shared evidence contract.
- Mock audit provider.

## Scope

- Add normalized technical page observations.
- Add deterministic technical audit rules.
- Generate audit issues from page observations.
- Attach evidence IDs to each issue.
- Show rule and evidence provenance in the audit workspace.
- Add unit and E2E coverage.

## Exclusions

- No live crawler.
- No robots or sitemap fetcher.
- No large audit ruleset.
- No database-backed audit run persistence.

## Architecture

`lib/engines/technical-audit.ts` consumes normalized `TechnicalPageObservation` records and emits `AuditIssue` records. The demo data exports `auditIssues` from this engine, so UI and `/api/audit` use the same rule output.

## Evidence Design

Each technical issue has evidence IDs that resolve to shared `EvidenceReference` records. Evidence is labeled simulated and, where relevant, estimated.

## Security

No network crawling was added. This slice only processes seeded observations.

## Telemetry

No new events were added. Existing audit navigation remains unchanged.

## Tests

- Unit tests verify issue generation and duplicate metadata removal.
- E2E verifies the audit workspace renders rule evidence.

## Acceptance Criteria

- Complete: technical issues are generated from normalized observations.
- Complete: issues include rule ID, impact area, recommended action and evidence IDs.
- Complete: audit UI exposes rule evidence.
- Complete: tests and build pass.

## Known Limitations

- The page observations are seeded demo records.
- The ruleset is intentionally narrow.
- No audit history, staleness handling, or provider retry logic exists yet.

## Next Logical Slice

AI visibility observation with deterministic prompt families, mock runs, mentions, citations, and variability.
