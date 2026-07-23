# Slice: Prisma audit/evidence store

## Problem

The demo audit could persist locally, but production deployments need durable audit runs and provenance records without changing the normalized API contract.

## User outcome

An audit run can be saved and read through the same repository used by the dashboard, with issues and evidence linked to a project and audit run in PostgreSQL.

## Scope

- Add a Prisma repository behind `AuditRunRepository`.
- Persist run URL, provider, status, crawl metadata, normalized issues, and evidence references.
- Enforce project existence and optional organization scoping in the adapter.
- Keep the file store as the default for offline/demo mode.

## Exclusions

- Authentication wiring and session-derived organization IDs.
- Automatic migrations or provisioning of a production database.
- Replacing the existing local demo store.

## Architecture

`getAuditRunRepository()` selects `FileAuditRunRepository` by default and `PrismaAuditRunRepository` when `OPENGROWTH_AUDIT_STORE=prisma`. Both implement `AuditRunRepository`, so API and UI code consume normalized `AuditRunRecord` values.

## Evidence design

Evidence records use the existing typed provenance fields. `sourceRecordId` points to the persisted audit run, while deterministic issue metadata is retained in `AuditIssue.rawData` for forward-compatible schema evolution.

## Security

The adapter verifies that the project exists and can optionally constrain it by `organizationId`. A production route must pass a session-derived organization ID; never trust a browser-supplied organization ID.

## Known limitations

The generated Prisma client in this repository is currently a lightweight placeholder until a database client can be regenerated in the deployment environment. The file adapter remains the tested local path. Prisma schema validation passes.

## Next logical slice

Wire authenticated organization context into the audit API and add migration/seed automation for PostgreSQL deployments.
