# SLICE-CONTENT-GAP

## Problem

The content planner previously displayed prewritten opportunities. It did not prove that an opportunity came from a business-context and page-coverage gap.

## User Outcome

The user can open the content planner, see opportunities ranked by business fit and missing coverage, and generate a brief that includes evidence, assumptions, claim checks, internal links, and measurement steps.

## Existing Reusable Work

- Content planner UI in `components/content-planner.tsx`.
- Demo project and evidence records in `lib/data/demo.ts`.
- Opportunity scoring in `lib/engines/priority.ts`.
- Evidence contract from `SLICE-REC-EVIDENCE`.

## Scope

- Add normalized business profile and website page profiles.
- Add a business-aware content gap engine.
- Build content opportunities from candidates only when existing pages do not cover the service-audience pairing.
- Attach evidence references and generated brief structure.
- Show evidence and claim verification in the content brief modal.
- Add unit and E2E coverage.

## Exclusions

- No real Search Console or keyword provider.
- No live crawler.
- No generated long-form article publishing.
- No second recommendation ranking slice.

## Architecture

`lib/engines/content-gap.ts` consumes business profile, existing pages, and candidates. It filters covered service-audience pairings, enriches remaining opportunities with brief structure, and returns ranked UI-ready opportunities.

## Evidence Design

Each opportunity carries evidence IDs that point to the shared `EvidenceReference` records. Demo evidence is explicitly marked simulated and estimated where appropriate.

## Security

No external fetches or unsafe HTML rendering were added. Generated brief output is structured text rendered as React content.

## Telemetry

The existing `content_opportunity_opened` event is preserved.

## Tests

- Unit tests verify opportunity generation and coverage filtering.
- E2E verifies the content planner opens an evidence-backed brief.

## Acceptance Criteria

- Complete: opportunities are generated from normalized business/page/candidate inputs.
- Complete: covered service-audience pairings are filtered.
- Complete: brief modal shows evidence and claims to verify.
- Complete: tests and build pass.

## Known Limitations

- Search and competition values remain deterministic demo estimates.
- Existing page profiles are seeded, not crawled.
- The brief generator does not yet create a full draft or version history.

## Next Logical Slice

Evidence-backed technical recommendation from normalized page observations and deterministic audit rules.
