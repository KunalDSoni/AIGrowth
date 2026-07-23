/**
 * Display-layer metric accessors for the marketing surfaces. Wraps raw engine
 * numbers into typed Metrics at the boundary, without changing the persisted
 * engine result types.
 */

import type { GeoResult } from "@/lib/analyze/types";
import { percentValue, usd } from "@/lib/metrics/construct";
import { MIN_RELIABLE, wilsonInterval } from "@/lib/metrics/wilson";
import type { Metric } from "@/lib/metrics/types";

export function geoMentionMetric(
  geo: Pick<GeoResult, "brandMentionRate" | "sampleSize">,
): Metric<"percent"> {
  const n = geo.sampleSize;
  const successes = Math.max(0, Math.min(n, Math.round((geo.brandMentionRate / 100) * n)));
  return percentValue(geo.brandMentionRate, {
    basis: "measured",
    evidenceIds: [],
    sample: { n, minReliable: MIN_RELIABLE.geoMentionRate },
    interval: wilsonInterval(successes, n) ?? undefined,
  });
}

export function geoCostMetric(geo: Pick<GeoResult, "cost">): Metric<"usd"> {
  return usd(geo.cost.estimatedUsd, {
    basis: "estimated",
    evidenceIds: [],
    assumptions: ["Blended $0.10 / 1M tokens; provider billing may differ."],
  });
}
