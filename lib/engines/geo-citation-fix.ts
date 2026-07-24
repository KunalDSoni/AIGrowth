/**
 * GIL-05 — Citation-Fix recommender (the keystone bridge).
 *
 * Converts the brand gap diff (GIL-03) + fix taxonomy (GIL-04) into specific,
 * ranked, evidence-gated Citation-Fixes: what to create, why it earns citations,
 * which prompts it affects, a *directional* expected-lift band, effort, priority,
 * confidence, and honesty assumptions. Pure over its inputs.
 */

import type { AnswerFitnessFlag, BrandGapDiff } from "@/lib/engines/geo-brand-gap-diff";
import { FIX_TYPES, type FixEffort, type FixTypeId } from "@/lib/engines/geo-fix-taxonomy";

/** Neutral learned weight — the Beta prior mean; leaves ranking on the static baseImpact. */
const NEUTRAL_WEIGHT = 0.5;

export type ExpectedLiftBand = "low" | "moderate" | "high";
export type FixConfidence = "Low" | "Medium";

export interface CitationFix {
  id: string;
  fixTypeId: FixTypeId;
  feature: AnswerFitnessFlag;
  title: string;
  whatToCreate: string;
  whyItEarnsCitations: string;
  affectedPrompts: string[];
  competitorShare: number;
  effort: FixEffort;
  expectedLiftBand: ExpectedLiftBand;
  priority: number;
  confidence: FixConfidence;
  evidenceIds: string[];
  assumptions: string[];
}

export interface CitationFixPlan {
  reliable: boolean;
  fixes: CitationFix[];
  note?: string;
}

const ASSUMPTIONS = [
  "Expected-lift band is directional, not a measured or guaranteed result.",
  "A fix must help users first — do not create content only to influence AI answers.",
  "Do not fabricate specifics such as awards, clients, or statistics.",
];

function bandFor(priority: number): ExpectedLiftBand {
  if (priority >= 3) return "high";
  if (priority >= 1.5) return "moderate";
  return "low";
}

export function buildCitationFixPlan(
  diff: BrandGapDiff,
  opts?: { evidenceIds?: string[]; sampleReliable?: boolean; weights?: Record<FixTypeId, number> },
): CitationFixPlan {
  const evidenceIds = opts?.evidenceIds ?? [];
  const confident = diff.reliable && opts?.sampleReliable !== false;

  const fixes: CitationFix[] = diff.topGaps.map((gap) => {
    const def = FIX_TYPES[gap.feature];
    const promptWeight = Math.min(gap.affectedPrompts.length, 5) / 5;
    // GIL-15: blend the learned outcome weight (posterior mean) into the static
    // baseImpact prior. A neutral 0.5 weight leaves ranking unchanged; a proven
    // winner is boosted, a proven loser demoted. Centred on the prior so learning
    // adjusts rather than replaces the documented default.
    const learnedFactor = opts?.weights ? (opts.weights[def.id] ?? NEUTRAL_WEIGHT) / NEUTRAL_WEIGHT : 1;
    const priority =
      Math.round(def.baseImpact * gap.competitorShare * (0.5 + 0.5 * promptWeight) * learnedFactor * 100) / 100;
    return {
      id: `fix-${def.id}`,
      fixTypeId: def.id,
      feature: gap.feature,
      title: def.label,
      whatToCreate: def.description,
      whyItEarnsCitations: def.rationale,
      affectedPrompts: [...gap.affectedPrompts],
      competitorShare: gap.competitorShare,
      effort: def.effort,
      expectedLiftBand: bandFor(priority),
      priority,
      confidence: confident ? "Medium" : "Low",
      evidenceIds,
      assumptions: [...ASSUMPTIONS],
    };
  });

  fixes.sort((a, b) => b.priority - a.priority || a.feature.localeCompare(b.feature));

  let note: string | undefined;
  if (fixes.length === 0) {
    note = diff.reliable
      ? "No cited-source feature gaps found — the brand already matches the cited sources on the measured features."
      : "No cited source could be read, so no feature gaps could be identified.";
  } else if (!confident) {
    note = "Directional only — small or unread sample; treat these fixes as low-confidence.";
  }

  return { reliable: diff.reliable, fixes, note };
}
