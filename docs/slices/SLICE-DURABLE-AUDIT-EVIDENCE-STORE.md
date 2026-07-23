# SLICE-DURABLE-AUDIT-EVIDENCE-STORE

## Problem

Audit API responses were only held in browser storage. That made evidence unavailable to server-side workflows and erased the latest run when local browser state changed.

## User Outcome

Each `/api/audit` call now saves a local durable audit run record with source, status, issues, evidence, crawl data and fallback errors. The audit workspace reads the latest server-side run and falls back to browser state if needed.

## Scope

- Add an audit run repository contract.
- Add a file-backed local implementation under `.opengrowth/audit-runs.json`.
- Persist simulated, fallback and live crawler audit runs.
- Add `GET /api/audit/latest`.
- Update the audit workspace latest-run panel.
- Add unit and E2E tests.

## Exclusions

- No PostgreSQL runtime repository yet.
- No multi-user authorization.
- No audit history table UI.
- No migrations were generated.

## Architecture

`lib/repositories/audit-runs.ts` defines `AuditRunRepository` and `FileAuditRunRepository`. The API route uses `getAuditRunRepository()` to save audit runs. Runtime data is ignored by git through `.opengrowth`.

## Security

The store is local development storage. Production must replace it with an authenticated, organization-scoped database repository.

## Tests

- Unit tests verify save/latest/list behavior.
- E2E verifies onboarding creates a persisted run visible in the audit workspace.

## Acceptance Criteria

- Complete: audit API persists each run locally.
- Complete: latest run is available through API.
- Complete: audit workspace displays the latest persisted run.
- Complete: tests and build pass.

## Known Limitations

- File storage is not safe for concurrent production writes.
- Project ID is fixed to the demo project.
- Runtime authorization is not implemented.

## Next Logical Slice

Add a Prisma-backed repository and authenticated project scope.
