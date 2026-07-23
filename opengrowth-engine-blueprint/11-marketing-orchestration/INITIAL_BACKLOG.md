# Initial Backlog

## Now

### ORCH-001: Campaign Model

Stories:

- As a user, I can use this capability so the product produces better evidence-backed decisions.
- As the system, I can store normalized data with provenance.
- As the recommendation engine, I can consume this output without depending on UI-only data.

Tasks:

- Verify existing repository implementation.
- Add or update normalized model.
- Add provenance fields.
- Add service contract.
- Add unit tests.
- Add at least one user-visible path when practical.

### ORCH-002: Recommendation-to-Campaign Flow

Stories:

- As a user, I can see the engine move from raw data to a useful conclusion.
- As the system, I can label simulated, inferred, estimated, and observed data.

Tasks:

- Build the smallest vertical slice.
- Connect it to the evidence contract.
- Add empty, loading, and error states where UI exists.
- Document limitations.

## Next

- ORCH-003 Channel Plan Builder
- ORCH-004 Task and Owner Workflow
- ORCH-005 Approval Gate Framework

## Later

- ORCH-006 UTM and Tracking Plan
- ORCH-007 Calendar View
- ORCH-008 Mock Publishing Handoff
- ORCH-009 Campaign Progress UI
