import type { Metric } from "@/lib/metrics/types";

/** A sampled metric is reliable only at or above its minimum sample. */
export function isReliable(m: Metric): boolean {
  if (!Number.isFinite(m.value)) return false;
  if (!m.sample) return true;
  return m.sample.n >= m.sample.minReliable;
}

export function gateMessage(m: Metric): string {
  if (!m.sample) return "Insufficient data";
  return `Insufficient sample — n=${m.sample.n}, need ${m.sample.minReliable}`;
}

/** The single place a metric becomes text. No display site multiplies a percent. */
export function formatMetric(m: Metric): string {
  if (!Number.isFinite(m.value)) return "—";
  switch (m.unit) {
    case "percent":
      return `${Math.round(m.value)}%`;
    case "usd":
      return `$${m.value.toFixed(2)}`;
    case "hours":
      return `${m.value}h`;
    case "days":
      return `${m.value}d`;
    case "ratio":
      return m.value.toFixed(2);
    case "score":
    case "count":
    default:
      return `${Math.round(m.value)}`;
  }
}
