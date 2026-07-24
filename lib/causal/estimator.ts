// lib/causal/estimator.ts
import type { ConfidenceLabel, LiftResult, OutcomeSeries } from "./types";
import { mean, splitAround } from "./outcomes";

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

/** Diff-in-differences lift for a geo-holdout / time-pulse (treat vs control, pre vs post). */
export function diffInDiff(
  treat: OutcomeSeries,
  control: OutcomeSeries,
  startedAt: string,
  label: ConfidenceLabel,
): LiftResult {
  const t = splitAround(treat, startedAt);
  const c = splitAround(control, startedAt);
  const counterfactual = mean(t.pre) + (mean(c.post) - mean(c.pre));
  const actual = mean(t.post);
  const liftPct = ((actual - counterfactual) / counterfactual) * 100;

  const tVar = stdev(t.post.map((p) => p.value)) ** 2 / Math.max(t.post.length, 1);
  const cVar = stdev(c.post.map((p) => p.value)) ** 2 / Math.max(c.post.length, 1);
  const seAbs = Math.sqrt(tVar + cVar);
  const marginPct = ((1.96 * seAbs) / counterfactual) * 100;

  return {
    liftPct: round1(liftPct),
    interval: { low: round1(liftPct - marginPct), high: round1(liftPct + marginPct) },
    label,
    method: "diff_in_diff",
    basis: "measured",
    note: `Diff-in-differences vs matched control over ${t.post.length} post-periods.`,
  };
}

export { stdev, round1 };
