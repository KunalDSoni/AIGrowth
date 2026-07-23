# Initial Backlog

## Now

### SEARCH-001: Search Evidence Provider Contract

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

### SEARCH-002: Query Normalization

Stories:

- As a user, I can see the engine move from raw data to a useful conclusion.
- As the system, I can label simulated, inferred, estimated, and observed data.

Tasks:

- Build the smallest vertical slice.
- Connect it to the evidence contract.
- Add empty, loading, and error states where UI exists.
- Document limitations.

## Next

- SEARCH-003 Intent Classification
- SEARCH-004 Topic Clustering
- SEARCH-005 Page-Query Mapping

## Later

- SEARCH-006 Content Gap Detection
- SEARCH-007 Cannibalization Signals
- SEARCH-008 Local Search Opportunities
- SEARCH-009 Commercial Opportunity Scoring
