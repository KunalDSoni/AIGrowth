# SLICE-REC-EVIDENCE

## Problem

The app shows prioritized actions, but those actions are mostly static. A user cannot inspect the evidence, score components, assumptions, dependencies, risk, completion definition, or measurement plan behind a recommendation.

## User Outcome

A user opens a recommendation and can answer:

- Why this action is prioritized.
- Which evidence supports it.
- Whether the evidence is observed, inferred, calculated, or simulated.
- What assumptions connect the evidence to the action.
- What done means.
- How the outcome should be measured.

## Existing Reusable Work

- Recommendation UI: `components/recommendation-card.tsx`, `components/recommendation-detail.tsx`.
- Seeded Northstar data: `lib/data/demo.ts`.
- Priority helpers: `lib/engines/priority.ts`.
- Prisma `Recommendation` model.
- E2E journey for viewing/generating/completing recommendations.

## Scope

- Add shared evidence/provenance types.
- Extend recommendations with evidence references, score components, assumptions, dependencies, risks, completion criteria, and measurement plans.
- Calculate priority score from normalized impact and feasibility components.
- Render score explanation and evidence on recommendation detail pages.
- Add tests for score components and evidence-linked recommendation data.
- Align Prisma schema with evidence and score metadata for later server persistence.

## Exclusions

- No real crawler.
- No real search provider.
- No AI visibility observations.
- No authenticated organization runtime.
- No database migrations in this run.
- No redesign of existing routes.

## Architecture

Runtime remains deterministic demo data. The selected slice adds normalized domain models and transforms seeded recommendation intelligence into UI-ready recommendation objects. The future database path is represented in Prisma with evidence and recommendation metadata fields.

## Data Model

Evidence records include kind, source, timestamps, reliability, estimated/simulated flags, summary, normalized value, and metadata. Recommendations reference evidence IDs and include score components plus decision-support fields.

## Evidence Design

Every recommendation can expose:

- Supporting evidence IDs.
- Source and reliability.
- Whether evidence is simulated or estimated.
- An assumption that connects evidence to the recommended action.

## API Contracts

No new public API is required. Existing `/api/generate` continues to work with recommendation context. Future APIs should return the same normalized evidence and recommendation shapes.

## Security

No external network calls are added. No unsafe HTML rendering is added. User mutation remains limited to localStorage completion in the demo.

## Telemetry

Existing events remain active:

- `recommendation_viewed`
- `fix_generated`
- `fix_approved`
- `recommendation_completed`

No new analytics provider is added.

## Tests

- Unit tests for priority component scoring.
- Unit tests for evidence-linked recommendation integrity.
- Existing E2E recommendation path must continue passing.

## Acceptance Criteria

- Complete: recommendation detail pages show evidence and scoring details.
- Complete: priority score is derived from score components.
- Complete: evidence provenance is visible and clearly marks simulated/estimated data.
- Complete: documentation matches implementation.
- Complete: typecheck, lint, unit tests, E2E tests, Prisma validation, and production build pass.

## Known Limitations

- Evidence is still deterministic demo evidence.
- Score inputs are curated, not learned from live provider data.
- localStorage is not durable multi-user persistence.
- Authorization is documented but not implemented in runtime demo.

## Next Logical Slice

Business-aware content gap detection using the business profile, existing pages, and evidence-linked opportunity generation.
