/**
 * PRE-2 — Analysis Engine (Proprietary Research Engine, Frontier 3).
 *
 * Computes the findings a study will publish — proportions and segment
 * comparisons — with a 95% confidence interval on every statistic. Two
 * non-negotiables are baked into the return type, not left to the caller:
 *
 *  1. Every stat carries its provenance: `n`, the contributing `sources`, and a
 *     plain-English `method`. A finding with no sources is impossible to build
 *     here.
 *  2. A finding can never claim more strength than the Methodology Guard (PRE-1)
 *     granted the study, AND never more than its own statistics support — an
 *     imprecise proportion or a non-significant comparison is capped at
 *     "directional", never spun to "supported".
 *
 * Reuses the shared statistics primitives (`wilsonInterval`,
 * `twoProportionPValue`) rather than re-deriving them.
 */

import { wilsonInterval } from "@/lib/metrics/wilson";
import { twoProportionPValue } from "@/lib/metrics/significance";
import {
  weakestStrength,
  type ClaimStrength,
} from "@/lib/engines/research-methodology-guard";

/** One observed unit of the dataset. */
export interface ResearchObservation {
  /** Where this observation came from (used for provenance + dominance). */
  source: string;
  /** Optional pre-declared segment this observation belongs to. */
  segment?: string;
  /** Whether the observation exhibits the studied trait (for proportion stats). */
  hit: boolean;
}

export type FindingKind = "proportion" | "comparison";

export interface StatFinding {
  id: string;
  kind: FindingKind;
  /** Plain-English statement of the finding. */
  headline: string;
  /** Percent (0–100) for a proportion; percentage-point delta for a comparison. */
  value: number;
  unit: "percent";
  interval: { low: number; high: number; method: "wilson" };
  /** Sample size behind this specific finding. */
  n: number;
  /** Distinct sources contributing to this finding. */
  sources: string[];
  /** Plain-English method statement. */
  method: string;
  /** Capped by both the study's methodology strength and this finding's statistics. */
  strength: ClaimStrength;
  /** Two-proportion p-value (comparison findings only). */
  pValue?: number;
  /** True only when significant AND strength is not insufficient (comparison only). */
  significant?: boolean;
}

/**
 * Precision → strength. A wide interval means low precision, which cannot support
 * a "supported" claim regardless of how the sampling looked.
 */
export const ANALYSIS = {
  /** Interval width (percentage points) at/under which precision allows "supported". */
  PRECISE_WIDTH: 20,
  /** Interval width at/under which precision allows "directional"; wider → insufficient. */
  DIRECTIONAL_WIDTH: 40,
  /** Below this per-finding n, a finding is insufficient regardless of interval. */
  MIN_FINDING_N: 5,
  /** Significance threshold for comparison findings. */
  ALPHA: 0.05,
} as const;

export const ANALYSIS_VERSION = 1;

const round1 = (v: number) => Math.round(v * 10) / 10;
const distinct = (xs: string[]) => Array.from(new Set(xs));

/** The strongest strength this finding's own statistics permit. */
function precisionStrength(n: number, width: number): ClaimStrength {
  if (n < ANALYSIS.MIN_FINDING_N || width > ANALYSIS.DIRECTIONAL_WIDTH) return "insufficient";
  if (width <= ANALYSIS.PRECISE_WIDTH) return "supported";
  return "directional";
}

/**
 * A single proportion finding: "X% of the sample exhibits the trait", with a
 * Wilson interval and provenance. `trait` names what `hit` means.
 */
export function analyzeProportion(
  observations: ResearchObservation[],
  opts: { trait: string; method: string; methodologyStrength: ClaimStrength; id?: string },
): StatFinding {
  const n = observations.length;
  const hits = observations.filter((o) => o.hit).length;
  const sources = distinct(observations.map((o) => o.source));
  const interval = wilsonInterval(hits, n) ?? { low: 0, high: 0, method: "wilson" as const };
  const value = n > 0 ? round1((hits / n) * 100) : 0;
  const width = interval.high - interval.low;

  const stat = n > 0 ? precisionStrength(n, width) : "insufficient";
  const strength = weakestStrength(opts.methodologyStrength, stat);

  return {
    id: opts.id ?? `proportion:${opts.trait}`,
    kind: "proportion",
    headline: `${value}% ${opts.trait} (n=${n})`,
    value,
    unit: "percent",
    interval,
    n,
    sources,
    method: opts.method,
    strength,
  };
}

/**
 * A segment comparison: the percentage-point gap in the trait rate between two
 * pre-declared segments, with a two-proportion significance test. Not
 * significant → capped at directional (we will not claim a real difference).
 */
export function analyzeSegmentComparison(
  observations: ResearchObservation[],
  opts: {
    trait: string;
    segmentA: string;
    segmentB: string;
    method: string;
    methodologyStrength: ClaimStrength;
    id?: string;
  },
): StatFinding {
  const a = observations.filter((o) => o.segment === opts.segmentA);
  const b = observations.filter((o) => o.segment === opts.segmentB);
  const ka = a.filter((o) => o.hit).length;
  const kb = b.filter((o) => o.hit).length;
  const na = a.length;
  const nb = b.length;
  const n = na + nb;
  const sources = distinct([...a, ...b].map((o) => o.source));

  const rateA = na > 0 ? (ka / na) * 100 : 0;
  const rateB = nb > 0 ? (kb / nb) * 100 : 0;
  const delta = round1(rateA - rateB);
  const pValue = twoProportionPValue(ka, na, kb, nb);

  // The interval on the *difference* isn't Wilson; approximate precision from the
  // smaller arm's Wilson width — the comparison is only as precise as its weakest arm.
  const wa = wilsonInterval(ka, na);
  const wb = wilsonInterval(kb, nb);
  const worstWidth = Math.max(
    wa ? wa.high - wa.low : Infinity,
    wb ? wb.high - wb.low : Infinity,
  );
  const arms = Math.min(na, nb);

  let strength = weakestStrength(opts.methodologyStrength, precisionStrength(arms, worstWidth));
  const significant = pValue < ANALYSIS.ALPHA && strength !== "insufficient";
  if (!significant) strength = weakestStrength(strength, "directional");

  const interval = {
    low: round1(delta - (Number.isFinite(worstWidth) ? worstWidth : 0)),
    high: round1(delta + (Number.isFinite(worstWidth) ? worstWidth : 0)),
    method: "wilson" as const,
  };

  return {
    id: opts.id ?? `comparison:${opts.trait}:${opts.segmentA}-vs-${opts.segmentB}`,
    kind: "comparison",
    headline: `${opts.segmentA} ${delta >= 0 ? "leads" : "trails"} ${opts.segmentB} by ${Math.abs(delta)}pp on ${opts.trait} (n=${n})`,
    value: delta,
    unit: "percent",
    interval,
    n,
    sources,
    method: opts.method,
    strength,
    pValue: round1(pValue * 1000) / 1000,
    significant,
  };
}
