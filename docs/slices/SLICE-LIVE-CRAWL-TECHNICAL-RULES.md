# SLICE-LIVE-CRAWL-TECHNICAL-RULES

## Problem

The safe crawler could normalize one live page, but `/api/audit` still returned simulated issues after a successful crawl.

## User Outcome

When `OPENGROWTH_REAL_CRAWL=true`, `/api/audit` now returns technical issues generated from the crawled page evidence, plus the normalized crawl evidence record. If crawling fails or is unsafe, the endpoint falls back to deterministic simulated issues.

## Scope

- Convert `CrawledPageEvidence` to `TechnicalPageObservation`.
- Run deterministic technical audit rules against live crawl evidence.
- Return live evidence-linked issues from `/api/audit`.
- Preserve simulated fallback.
- Add unit tests.

## Exclusions

- No multi-page crawl.
- No crawl persistence.
- No audit history UI.
- No live crawler route in the demo workspace.

## Acceptance Criteria

- Complete: live crawl evidence feeds the technical rule engine.
- Complete: `/api/audit` returns `simulatedIssues:false` on successful opt-in crawl.
- Complete: fallback still returns simulated issues when crawl fails.
- Complete: tests and build pass.

## Known Limitations

- Single-page audit only.
- Duplicate metadata rules need multiple pages to be meaningful.
- Network access depends on runtime policy.

## Next Logical Slice

Persist provider evidence and audit runs to the database.
