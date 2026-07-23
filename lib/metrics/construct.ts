import { metricConfidence } from "@/lib/metrics/wilson";
import type { Metric, MetricBasis, MetricInterval, MetricSample, Unit } from "@/lib/metrics/types";

export interface ConstructOpts {
  basis: MetricBasis;
  evidenceIds: string[];
  sample?: MetricSample;
  interval?: MetricInterval;
  assumptions?: string[];
}

function build<U extends Unit>(value: number, unit: U, opts: ConstructOpts): Metric<U> {
  if (opts.basis === "estimated" && !(opts.assumptions && opts.assumptions.length)) {
    throw new Error("estimated metric requires assumptions");
  }

  const finite = Number.isFinite(value);
  const confidence = !finite
    ? ("insufficient" as const)
    : opts.sample
      ? metricConfidence(opts.interval ?? null, opts.sample)
      : undefined;

  return {
    value: finite ? value : Number.NaN,
    unit,
    basis: opts.basis,
    evidenceIds: opts.evidenceIds,
    ...(opts.sample ? { sample: opts.sample } : {}),
    ...(opts.interval ? { interval: opts.interval } : {}),
    ...(confidence ? { confidence } : {}),
    ...(opts.assumptions ? { assumptions: opts.assumptions } : {}),
  };
}

const clampPercent = (v: number) => Math.max(0, Math.min(100, v));

/** For a value already on a 0-100 scale (the GEO rate's existing contract). */
export function percentValue(value0to100: number, opts: ConstructOpts): Metric<"percent"> {
  return build(Number.isFinite(value0to100) ? clampPercent(value0to100) : value0to100, "percent", opts);
}

/** For a 0-1 fraction. Multiplies by 100 exactly once — the only such multiply. */
export function percentFromFraction(fraction: number, opts: ConstructOpts): Metric<"percent"> {
  return build(Number.isFinite(fraction) ? clampPercent(fraction * 100) : fraction, "percent", opts);
}

export function count(value: number, opts: ConstructOpts): Metric<"count"> {
  return build(value, "count", opts);
}

export function score(value0to100: number, opts: ConstructOpts): Metric<"score"> {
  return build(value0to100, "score", opts);
}

export function usd(value: number, opts: ConstructOpts): Metric<"usd"> {
  return build(value, "usd", opts);
}

export function hours(value: number, opts: ConstructOpts): Metric<"hours"> {
  return build(value, "hours", opts);
}
