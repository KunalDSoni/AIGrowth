/**
 * MLE-6a — Legibility Score + before/after movement (Machine Legibility Engine).
 *
 * One score for how accurately and favorably machines perceive the brand across
 * both lenses: answer-engine accuracy (how right is machine belief vs truth) and
 * shopping-agent readability (how buyable is the product). Re-measured after
 * corrections, it shows honest before/after movement — and, borrowing Frontier
 * 1's causal discipline, refuses to claim movement on too few measured beliefs.
 */

import type { LegibilityGap } from "@/lib/engines/legibility-gap-finder";
import type { ShoppingAgentReport } from "@/lib/engines/legibility-shopping-agent-lens";

export type LegibilityGrade = "strong" | "moderate" | "weak";

export interface LegibilityScore {
  /** 0–100 blended score. */
  overall: number;
  /** 0–100 accuracy of machine belief vs verified truth. */
  answerEngine: number;
  /** 0–100 product agent-readability (undefined when no product lens ran). */
  shoppingAgent?: number;
  grade: LegibilityGrade;
  /** Number of machine beliefs measured — the basis for movement reliability. */
  beliefsMeasured: number;
  method: string;
}

export type MovementLabel = "improved" | "unchanged" | "regressed" | "insufficient";

export interface LegibilityMovement {
  before: number;
  after: number;
  delta: number;
  label: MovementLabel;
  note: string;
}

export const LEGIBILITY_SCORE = {
  /** answer-engine weight in the blend. */
  ANSWER_WEIGHT: 0.6,
  /** shopping-agent weight in the blend. */
  SHOPPING_WEIGHT: 0.4,
  /** Minimum measured beliefs to claim a movement (else "insufficient"). */
  MIN_BELIEFS_FOR_MOVEMENT: 3,
  /** Score-point change under which movement is "unchanged". */
  MOVEMENT_EPSILON: 3,
} as const;

export const LEGIBILITY_SCORE_VERSION = 1;

const clamp100 = (v: number) => Math.max(0, Math.min(100, v));

function grade(score: number): LegibilityGrade {
  if (score >= 80) return "strong";
  if (score >= 50) return "moderate";
  return "weak";
}

/**
 * Build the legibility score. Answer-engine accuracy starts at 100 and is
 * reduced by each gap's impact, normalised by how many beliefs machines hold —
 * so a single bad gap among many correct beliefs hurts less than one among few.
 */
export function buildLegibilityScore(input: {
  gaps: LegibilityGap[];
  beliefsMeasured: number;
  shopping?: ShoppingAgentReport;
}): LegibilityScore {
  const denom = Math.max(input.beliefsMeasured, 1);
  const penalty = input.gaps.reduce((s, g) => s + g.impact, 0) / denom;
  const answerEngine = Math.round(clamp100(100 - penalty));

  const shoppingAgent = input.shopping?.score;
  const overall =
    typeof shoppingAgent === "number"
      ? Math.round(
          answerEngine * LEGIBILITY_SCORE.ANSWER_WEIGHT +
            shoppingAgent * LEGIBILITY_SCORE.SHOPPING_WEIGHT,
        )
      : answerEngine;

  const method =
    typeof shoppingAgent === "number"
      ? `Blend of answer-engine accuracy (${answerEngine}) and shopping-agent readability (${shoppingAgent}) over ${input.beliefsMeasured} measured beliefs.`
      : `Answer-engine accuracy over ${input.beliefsMeasured} measured beliefs; no product lens run.`;

  return {
    overall,
    answerEngine,
    shoppingAgent,
    grade: grade(overall),
    beliefsMeasured: input.beliefsMeasured,
    method,
  };
}

/**
 * Compare a before/after score honestly. If either measurement rests on too few
 * beliefs, the movement is "insufficient" — we do not claim a change we cannot
 * stand behind.
 */
export function compareLegibility(before: LegibilityScore, after: LegibilityScore): LegibilityMovement {
  const delta = after.overall - before.overall;
  const minBeliefs = Math.min(before.beliefsMeasured, after.beliefsMeasured);

  let label: MovementLabel;
  let note: string;
  if (minBeliefs < LEGIBILITY_SCORE.MIN_BELIEFS_FOR_MOVEMENT) {
    label = "insufficient";
    note = `Only ${minBeliefs} measured belief(s) — too few to claim a movement.`;
  } else if (Math.abs(delta) < LEGIBILITY_SCORE.MOVEMENT_EPSILON) {
    label = "unchanged";
    note = `Change of ${delta} points is within noise (±${LEGIBILITY_SCORE.MOVEMENT_EPSILON}).`;
  } else if (delta > 0) {
    label = "improved";
    note = `Legibility rose ${delta} points after corrections.`;
  } else {
    label = "regressed";
    note = `Legibility fell ${Math.abs(delta)} points.`;
  }

  return { before: before.overall, after: after.overall, delta, label, note };
}
