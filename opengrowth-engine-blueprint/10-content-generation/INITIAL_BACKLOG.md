# Initial Backlog

## Now

### GEN-001: Brief Contract

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

### GEN-002: AI Provider Abstraction

Stories:

- As a user, I can see the engine move from raw data to a useful conclusion.
- As the system, I can label simulated, inferred, estimated, and observed data.

Tasks:

- Build the smallest vertical slice.
- Connect it to the evidence contract.
- Add empty, loading, and error states where UI exists.
- Document limitations.

## Next

- GEN-003 Metadata Generation
- GEN-004 Service Page Generation
- GEN-005 Article Brief and Draft Generation

## Later

- GEN-006 FAQ and Schema Proposal
- GEN-007 Social and Email Repurposing
- GEN-008 Claim Verification Workflow
- GEN-009 Versioning and Diff View
