# GIL-05 — Citation-Fix recommender — Design

**Date:** 2026-07-24
**Status:** Approved
**Slice:** GEO Influence Loop, Stage B, epic 5 — **the keystone bridge** from measurement to action.

## Why

This is the unit that converts everything upstream into a *specific, ranked, gated action*.
It reads the brand gap diff (GIL-03) and the fix taxonomy (GIL-04) and emits, per real gap, a
Citation-Fix: what to create, why it earns citations, which prompts it affects, a directional
expected-lift band, effort, priority, confidence, evidence IDs, and honesty assumptions.

## Design

`lib/engines/geo-citation-fix.ts`:

```ts
import type { BrandGapDiff, AnswerFitnessFlag } from "@/lib/engines/geo-brand-gap-diff";
import type { FixTypeId, FixEffort } from "@/lib/engines/geo-fix-taxonomy";

export type ExpectedLiftBand = "low" | "moderate" | "high";
export type FixConfidence = "Low" | "Medium";

export interface CitationFix {
  id: string;                  // `fix-${fixTypeId}`
  fixTypeId: FixTypeId;
  feature: AnswerFitnessFlag;
  title: string;               // taxonomy label
  whatToCreate: string;        // taxonomy description
  whyItEarnsCitations: string; // taxonomy rationale
  affectedPrompts: string[];
  competitorShare: number;     // directional, from the gap
  effort: FixEffort;
  expectedLiftBand: ExpectedLiftBand; // directional band — never a measured %
  priority: number;            // ranking score (documented formula)
  confidence: FixConfidence;
  evidenceIds: string[];
  assumptions: string[];       // honesty labels, always present
}

export interface CitationFixPlan {
  reliable: boolean;
  fixes: CitationFix[];        // ranked by priority desc
  note?: string;               // set when not reliable / no gaps
}

export function buildCitationFixPlan(
  diff: BrandGapDiff,
  opts?: { evidenceIds?: string[]; sampleReliable?: boolean },
): CitationFixPlan;
```

## Ranking & bands (documented, directional)

For each gap in `diff.topGaps` (the `isGap` features only):

- **promptWeight** = `min(affectedPrompts.length, 5) / 5` (0.2..1.0) — more affected prompts
  = broader payoff, capped so one noisy prompt can't dominate.
- **priority** = `round(baseImpact × competitorShare × (0.5 + 0.5 × promptWeight) × 100) / 100`
  — `baseImpact` (GIL-04 prior, 1..5) × how dominant the feature is among competitors ×
  a prompt-breadth factor. Higher = do first.
- **expectedLiftBand**: `high` if priority ≥ 3, `moderate` if ≥ 1.5, else `low`. A *band*,
  explicitly directional — never a numeric lift percentage.
- **confidence**: `Medium` when `diff.reliable && sampleReliable !== false`, else `Low`.

Fixes sorted by `priority` desc, then `feature` asc for determinism.

## Honesty rules (enforced + tested)

- Every fix carries `assumptions` including: "Expected-lift band is directional, not a
  measured or guaranteed result." and "A fix must help users first — do not create content
  only to influence AI answers." and "Do not fabricate specifics (awards, clients, stats)."
- No fix is emitted for a feature the brand already has or that no competitor has (those are
  not in `topGaps`).
- `reliable` mirrors the diff; when `false`, still return fixes but downgrade every
  `confidence` to `Low` and set an honest `note`.
- Empty `topGaps` → `fixes: []` with a note ("No cited-source feature gaps found…").
- Pure; input not mutated.

## Scope boundaries

Out of scope: crew brief/drafting (GIL-07/08), API/UI (GIL-06), learned weights (GIL-15),
persistence. Consumes only the diff + taxonomy.

## Testing

- a diff with two gaps → two fixes, each with the taxonomy's title/description/rationale and
  the correct `fixTypeId`/`effort`.
- ranking: a higher `baseImpact × competitorShare × breadth` gap ranks first.
- expected-lift band thresholds: priority ≥3 → high, ≥1.5 → moderate, else low.
- confidence Medium when reliable and sampleReliable not false; Low when diff unreliable or
  `sampleReliable: false`.
- assumptions always include the directional-lift and help-users-first lines.
- empty topGaps → `[]` + note.
- unreliable diff → all confidences Low + note.
- evidenceIds passed through; input diff not mutated.
