# Initial Backlog

## Now

### CRAWL-001: URL Safety and SSRF Guard

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

### CRAWL-002: Crawl Run Lifecycle

Stories:

- As a user, I can see the engine move from raw data to a useful conclusion.
- As the system, I can label simulated, inferred, estimated, and observed data.

Tasks:

- Build the smallest vertical slice.
- Connect it to the evidence contract.
- Add empty, loading, and error states where UI exists.
- Document limitations.

## Next

- CRAWL-003 Fetcher and Redirect Validator
- CRAWL-004 Robots and Sitemap Discovery
- CRAWL-005 HTML Parsing and Normalization

## Later

- CRAWL-006 Link Graph Builder
- CRAWL-007 Page Classification
- CRAWL-008 Crawl Snapshot Diffing
- CRAWL-009 Crawl Error Handling
