/**
 * GIL-11 — Re-probe + lift attribution.
 *
 * Compare a post-change citation re-probe against the intervention's baseline on
 * the affected prompts, using the shared two-proportion significance test. Labels
 * the result honestly:
 *   - "causal"       significant change AND a control/holdout existed;
 *   - "directional"  significant change but no control (observational, confoundable);
 *   - "insufficient" sample too small, or change not statistically significant.
 *
 * A lift is never called causal without a control, and a non-significant change
 * is never reported as a lift. Pure comparison; the re-probe orchestration lives
 * in the route/wiring that produces `postLedger`.
 */

import type { CitationLedger } from "@/lib/analyze/types";
import { twoProportionPValue } from "@/lib/metrics/significance";
import { wilsonInterval } from "@/lib/metrics/wilson";
import type { MetricInterval } from "@/lib/metrics/types";
import type { InterventionRecord } from "@/lib/engines/geo-intervention";
import type { AnswerFitnessFlag } from "@/lib/engines/geo-brand-gap-diff";

const MIN_SAMPLE = 3;

export type LiftLabel = "causal" | "directional" | "insufficient";

interface CitedSnapshot {
  answered: number;
  brandCited: number;
  citedShare: number;
}

export interface CitationLift {
  fixId: string;
  feature: AnswerFitnessFlag;
  affectedPrompts: string[];
  baseline: CitedSnapshot;
  post: CitedSnapshot;
  deltaShare: number;
  postInterval: MetricInterval | null;
  pValue: number;
  significant: boolean;
  label: LiftLabel;
  note: string;
}

function snapshotOn(ledger: CitationLedger, prompts: Set<string>): CitedSnapshot {
  const answered = ledger.records.filter((r) => prompts.has(r.promptId) && r.status !== "unanswered");
  const brandCited = answered.filter((r) => r.brandCited).length;
  return {
    answered: answered.length,
    brandCited,
    citedShare: answered.length ? Math.round((brandCited / answered.length) * 100) / 100 : 0,
  };
}

export function attributeLift(input: {
  intervention: InterventionRecord;
  postLedger: CitationLedger;
  controlled?: boolean;
}): CitationLift {
  const { intervention, postLedger } = input;
  const prompts = new Set(intervention.affectedPrompts);
  const baseline: CitedSnapshot = {
    answered: intervention.baseline.answered,
    brandCited: intervention.baseline.brandCited,
    citedShare: intervention.baseline.citedShare,
  };
  const post = snapshotOn(postLedger, prompts);

  const deltaShare = Math.round((post.citedShare - baseline.citedShare) * 100) / 100;
  const pValue = twoProportionPValue(baseline.brandCited, baseline.answered, post.brandCited, post.answered);
  const significant = pValue < 0.05;
  const smallSample = baseline.answered < MIN_SAMPLE || post.answered < MIN_SAMPLE;

  let label: LiftLabel;
  let note: string;
  if (smallSample) {
    label = "insufficient";
    note = `Sample too small to attribute lift (baseline n=${baseline.answered}, post n=${post.answered}).`;
  } else if (!significant) {
    label = "insufficient";
    note = `Change is not statistically significant (p=${pValue.toFixed(3)}); no lift can be claimed.`;
  } else if (input.controlled) {
    label = "causal";
    note = `Significant change with a control (p=${pValue.toFixed(3)}) — attributable to the shipped fix.`;
  } else {
    label = "directional";
    note = `Significant change (p=${pValue.toFixed(3)}) but no control — directional, not proven causal.`;
  }

  return {
    fixId: intervention.fixId,
    feature: intervention.feature,
    affectedPrompts: [...intervention.affectedPrompts],
    baseline,
    post,
    deltaShare,
    postInterval: wilsonInterval(post.brandCited, post.answered),
    pValue,
    significant,
    label,
    note,
  };
}
