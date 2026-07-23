import type { MetricConfidence, MetricInterval, MetricSample } from "@/lib/metrics/types";

/** Per-metric minimum reliable sample sizes — the single source of truth. */
export const MIN_RELIABLE = {
  geoMentionRate: 20,
  firstPartyCitationShare: 15,
} as const;

const Z = 1.96; // 95%
const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** 95% Wilson score interval for k successes in n trials, on the 0-100 scale. */
export function wilsonInterval(successes: number, n: number): MetricInterval | null {
  if (!Number.isFinite(successes) || !Number.isFinite(n) || n <= 0) return null;
  const p = successes / n;
  const z2 = Z * Z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (Z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    low: Math.round(clamp((center - margin) * 100) * 100) / 100,
    high: Math.round(clamp((center + margin) * 100) * 100) / 100,
    method: "wilson",
  };
}

/** Confidence is a property of precision (interval width), not merely count. */
export function metricConfidence(
  interval: MetricInterval | null,
  sample?: MetricSample,
): MetricConfidence {
  if (sample && sample.n < sample.minReliable) return "insufficient";
  if (!interval) return "insufficient";
  const width = interval.high - interval.low;
  if (width <= 15) return "high";
  if (width <= 30) return "medium";
  return "low";
}
