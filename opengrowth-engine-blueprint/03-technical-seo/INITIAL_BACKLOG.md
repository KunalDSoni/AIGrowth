# Initial Backlog

## Now

### TSEO-001: Audit Rule Contract

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

### TSEO-002: Crawlability Checks

Stories:

- As a user, I can see the engine move from raw data to a useful conclusion.
- As the system, I can label simulated, inferred, estimated, and observed data.

Tasks:

- Build the smallest vertical slice.
- Connect it to the evidence contract.
- Add empty, loading, and error states where UI exists.
- Document limitations.

## Next

- TSEO-003 Indexability Checks
- TSEO-004 Metadata Checks
- TSEO-005 Heading and Content Structure Checks

## Later

- TSEO-006 Image SEO Checks
- TSEO-007 Structured Data Checks
- TSEO-008 Internal Link Health
- TSEO-009 Mobile and Accessibility Basics
