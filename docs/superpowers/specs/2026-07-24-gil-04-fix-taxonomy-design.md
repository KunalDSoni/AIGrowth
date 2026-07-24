# GIL-04 — Fix-type taxonomy & registry — Design

**Date:** 2026-07-24
**Status:** Approved
**Slice:** GEO Influence Loop, Stage B, epic 4 (opens the Prescribe stage).

## Why

GIL-03 emits missing answer-fitness features. GIL-05 must turn each into a *specific*
answer-optimized asset. GIL-04 is the documented, versioned catalog that maps every
answer-fitness flag to a fix type — one defensible source of truth (mirrors
`scoring-constants.ts`), so the recommender never hard-codes copy or priority.

## Design

`lib/engines/geo-fix-taxonomy.ts`:

```ts
import type { AnswerFitnessFlag } from "@/lib/engines/geo-brand-gap-diff";

export type FixTypeId =
  | "direct-answer" | "faq-block" | "comparison-page" | "pricing-page"
  | "freshness-refresh" | "structured-data" | "proof-block";

export type FixAssetType = "page" | "section" | "markup";
export type FixEffort = "low" | "medium" | "high";

export interface FixTypeDef {
  id: FixTypeId;
  addresses: AnswerFitnessFlag; // the gap flag this fix closes
  label: string;
  assetType: FixAssetType;
  effort: FixEffort;
  baseImpact: number;           // 1..5 default prior for ranking; GIL-15 refines with learned weights
  description: string;          // what to create (imperative, generic — no invented specifics)
  rationale: string;           // why it earns answer-engine citations
}

/** One entry per AnswerFitnessFlag — exhaustive and 1:1. */
export const FIX_TYPES: Record<AnswerFitnessFlag, FixTypeDef>;

export function fixForFlag(flag: AnswerFitnessFlag): FixTypeDef;
export const FIX_TAXONOMY_VERSION = 1;
```

The 7 entries (flag → fix):

| Flag | FixTypeId | asset | effort | baseImpact | Why it earns citations |
|---|---|---|---|---|---|
| hasDirectAnswer | direct-answer | section | low | 5 | Answer engines quote a concise definitional lead; absence means nothing to lift. |
| hasFaqStructure | faq-block | section | low | 4 | FAQ Q&A blocks map directly to buyer questions engines answer. |
| hasComparisonContent | comparison-page | page | medium | 4 | "X vs Y" pages are cited for shortlist/decision prompts. |
| hasStructuredPricing | pricing-page | page | medium | 3 | Engines cite sources that state concrete pricing signals. |
| hasFreshnessSignal | freshness-refresh | markup | low | 2 | Recency signals raise trust and citation likelihood. |
| hasStructuredData | structured-data | markup | low | 3 | Machine-readable schema makes facts extractable/citable. |
| hasProofSignal | proof-block | section | medium | 3 | Verifiable proof (cases, certifications) is preferentially cited. |

`baseImpact` and `effort` live here (single source of truth) with rationale, exactly as
`scoring-constants.ts` holds scoring numbers.

## Honesty rules

- `description` is generic and imperative ("Add a concise definitional lead paragraph…") —
  never invents company specifics; the crew fills specifics later under claim-check (GIL-08).
- `baseImpact` is a documented default *prior*, explicitly labelled directional, superseded
  by measured learned weights in GIL-15 — never presented as a measured lift.

## Scope boundaries

Out of scope: the recommender that consumes this (GIL-05), any per-account tuning, learned
weights (GIL-15), UI. Just the catalog + lookup + version.

## Testing

- `FIX_TYPES` has exactly one entry per `AnswerFitnessFlag` (all 7), and each entry's
  `addresses` equals its key.
- all `FixTypeId`s are unique.
- `baseImpact` ∈ 1..5; `effort` ∈ {low,medium,high}; `assetType` ∈ {page,section,markup}.
- `fixForFlag(flag)` returns the entry whose `addresses === flag`.
- `description` and `rationale` are non-empty for every entry.
