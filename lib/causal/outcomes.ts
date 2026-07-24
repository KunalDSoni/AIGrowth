// lib/causal/outcomes.ts
import type { OutcomePoint, OutcomeSeries, OutcomeUnit } from "./types";

export interface OutcomeStreamProvider {
  fetch(
    scope: { geoScope?: string; unit: OutcomeUnit },
    window: { from: string; to: string },
  ): Promise<OutcomeSeries>;
}

/** Split a series into pre/post windows around an intervention start (ISO). */
export function splitAround(
  series: OutcomeSeries,
  startedAt: string,
): { pre: OutcomePoint[]; post: OutcomePoint[] } {
  const t = Date.parse(startedAt);
  const pre: OutcomePoint[] = [];
  const post: OutcomePoint[] = [];
  for (const p of series.points) {
    if (Date.parse(p.period) < t) pre.push(p);
    else post.push(p);
  }
  return { pre, post };
}

export function mean(points: OutcomePoint[]): number {
  if (points.length === 0) return Number.NaN;
  return points.reduce((s, p) => s + p.value, 0) / points.length;
}
