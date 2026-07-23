# Initial Backlog

## Now

### COMP-001: Competitor Classification

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

### COMP-002: Competitor Profile Model

Stories:

- As a user, I can see the engine move from raw data to a useful conclusion.
- As the system, I can label simulated, inferred, estimated, and observed data.

Tasks:

- Build the smallest vertical slice.
- Connect it to the evidence contract.
- Add empty, loading, and error states where UI exists.
- Document limitations.

## Next

- COMP-003 Service Coverage Comparison
- COMP-004 Topic Coverage Comparison
- COMP-005 Technical Health Comparison

## Later

- COMP-006 Trust Signal Comparison
- COMP-007 AI Mention Comparison
- COMP-008 Citation Comparison
- COMP-009 Competitor Gap Conclusions
