# Initial Backlog

## Now

### CITE-001: Citation Normalization

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

### CITE-002: Source Classification

Stories:

- As a user, I can see the engine move from raw data to a useful conclusion.
- As the system, I can label simulated, inferred, estimated, and observed data.

Tasks:

- Build the smallest vertical slice.
- Connect it to the evidence contract.
- Add empty, loading, and error states where UI exists.
- Document limitations.

## Next

- CITE-003 Citation Aggregation
- CITE-004 Citation Stability Metrics
- CITE-005 First-Party Citation Gap

## Later

- CITE-006 Third-Party Source Gap
- CITE-007 Source Quality Signals
- CITE-008 Citation-to-Content Gap Mapping
- CITE-009 Citation Evidence UI
