# SLICE-LATEST-AUDIT-RUN

## Problem

The onboarding analysis flow did not retain the audit API response, so the audit workspace could not show whether the latest run used simulated fallback or opt-in crawler evidence.

## User Outcome

After onboarding, the audit workspace displays the latest audit API response source, timestamp, URL and crawler fallback/live-rule status from browser storage.

## Scope

- Call `/api/audit` during the analysis flow.
- Store the latest response in localStorage.
- Show a latest audit run panel in the audit workspace.
- Preserve the demo flow if the audit request fails.
- Add E2E coverage.

## Exclusions

- No database persistence.
- No audit history list.
- No server-side authorization.

## Acceptance Criteria

- Complete: onboarding stores latest audit response.
- Complete: audit workspace displays latest run source/status.
- Complete: failure does not block demo navigation.
- Complete: tests and build pass.

## Known Limitations

- Storage is browser-local.
- Stored response is not shared across users or devices.
- Live crawler remains opt-in.

## Next Logical Slice

Database-backed audit run and evidence repositories.
