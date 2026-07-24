# GIL-03 — Brand-page gap diff — Design

**Date:** 2026-07-24
**Status:** Approved
**Slice:** GEO Influence Loop, Stage A, epic 3 (closes the Diagnose stage).

## Why

GIL-02 gives us the answer-fitness features of the sources that *beat* the brand. GIL-03
answers: **what do those cited sources have that the brand's own pages lack?** It diffs the
brand's extracted answer-fitness features against the cited-source profiles and emits the
concrete, ranked missing features — the direct input to the GIL-05 recommender.

## Approach

Pure engine over two GIL-02-shaped inputs — no crawl of its own (the caller extracts the
brand's features with the same `extractAnswerFitness`, keeping GIL-03 pure and testable):

`lib/engines/geo-brand-gap-diff.ts`:

```ts
import type { AnswerFitnessFeatures, CitedSourceFeatureProfile } from "@/lib/engines/geo-cited-source-features";

export type AnswerFitnessFlag =
  | "hasDirectAnswer" | "hasFaqStructure" | "hasComparisonContent"
  | "hasStructuredPricing" | "hasFreshnessSignal" | "hasStructuredData" | "hasProofSignal";

export interface FeatureGap {
  feature: AnswerFitnessFlag;
  brandHas: boolean;
  competitorsWithFeature: number;   // among profiled+extracted cited sources
  competitorsProfiled: number;      // denominator (extracted profiles only)
  competitorShare: number;          // 0..1, rounded to 2dp
  affectedPrompts: string[];        // union of citedForPrompts of sources that have it
  isGap: boolean;                   // !brandHas && competitorsWithFeature > 0
}

export interface BrandGapDiff {
  brandFeatures: AnswerFitnessFeatures;
  gaps: FeatureGap[];    // all 7 flags, gaps first, then by competitorShare desc
  topGaps: FeatureGap[]; // isGap === true only, competitorShare desc
  reliable: boolean;     // at least one cited source was successfully extracted
}

export function buildBrandGapDiff(
  brandFeatures: AnswerFitnessFeatures,
  profiles: CitedSourceFeatureProfile[],
): BrandGapDiff;
```

## Algorithm

1. Consider only profiles with `crawlStatus === "extracted"` and `features` present — the
   denominator `competitorsProfiled`. Unreachable sources cannot claim a feature.
2. For each of the 7 boolean flags: `competitorsWithFeature` = count of extracted profiles
   whose `features[flag]` is true; `affectedPrompts` = deduped union of those profiles'
   `citedForPrompts`; `competitorShare` = `competitorsWithFeature / competitorsProfiled`
   (0 when denominator 0); `isGap` = brand lacks it AND ≥1 competitor has it.
3. `gaps` sorted: gaps (`isGap`) before non-gaps, then `competitorShare` desc, then feature
   name asc for determinism. `topGaps` = the `isGap` subset.
4. `reliable` = `competitorsProfiled > 0`.

## Honesty rules

- Unreachable/unextracted sources never count toward a feature — the denominator is only
  successfully-extracted sources, so a gap is never inferred from a page we couldn't read.
- `competitorShare` is a directional signal over a small sample; `reliable: false` when no
  source was extracted, and the diff surfaces it.
- Pure: no mutation of inputs; deterministic ordering.

## Scope boundaries

Out of scope: extracting the brand's own features (caller's job, reuses GIL-02 extractor +
crawler), fix-type mapping (GIL-04/05), ranking by expected lift, API/UI, persistence.

## Testing

- a flag the brand lacks and 2/3 competitors have → `isGap: true`, `competitorsWithFeature: 2`,
  `competitorShare: 0.67`, `affectedPrompts` unions the two sources' prompts.
- a flag the brand already has → `isGap: false` even if competitors have it.
- a flag no competitor has → `isGap: false`.
- unreachable profiles excluded from the denominator (2 extracted + 1 unreachable →
  `competitorsProfiled: 2`).
- no extracted profiles → `reliable: false`, every `competitorShare: 0`, no `topGaps`.
- `gaps` ordering puts gaps first then by share desc; `topGaps` is the isGap subset.
- input profiles/features not mutated.
