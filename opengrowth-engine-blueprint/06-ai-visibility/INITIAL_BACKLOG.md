# Initial Backlog

## Now

### AIV-001: Prompt Family Model

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

### AIV-002: Prompt Variant Generator

Stories:

- As a user, I can see the engine move from raw data to a useful conclusion.
- As the system, I can label simulated, inferred, estimated, and observed data.

Tasks:

- Build the smallest vertical slice.
- Connect it to the evidence contract.
- Add empty, loading, and error states where UI exists.
- Document limitations.

## Next

- AIV-003 AI Platform Provider Contract
- AIV-004 Observation Run Lifecycle
- AIV-005 Raw Answer Storage

## Later

- AIV-006 Mention Extraction
- AIV-007 Citation Extraction
- AIV-008 Sentiment and Prominence Signals
- AIV-009 Variability and Sample Size Metrics
