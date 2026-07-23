# Initial Backlog

## Now

### REC-001: Recommendation Candidate Contract

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

### REC-002: Evidence Chain Model

Stories:

- As a user, I can see the engine move from raw data to a useful conclusion.
- As the system, I can label simulated, inferred, estimated, and observed data.

Tasks:

- Build the smallest vertical slice.
- Connect it to the evidence contract.
- Add empty, loading, and error states where UI exists.
- Document limitations.

## Next

- REC-003 Transparent Scoring Formula
- REC-004 Candidate Deduplication
- REC-005 Dependency and Conflict Handling

## Later

- REC-006 Recommendation Grouping
- REC-007 Status Lifecycle
- REC-008 Measurement Plan Builder
- REC-009 Recommendation Detail UI
