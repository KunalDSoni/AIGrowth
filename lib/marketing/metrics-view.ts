/**
 * Display-layer metric accessors for the marketing surfaces. Wraps raw engine
 * numbers into typed Metrics at the boundary, without changing the persisted
 * engine result types.
 */

import type { GeoResult } from "@/lib/analyze/types";
import { usd } from "@/lib/metrics/construct";
import type { Metric } from "@/lib/metrics/types";

export function geoCostMetric(geo: Pick<GeoResult, "cost">): Metric<"usd"> {
  return usd(geo.cost.estimatedUsd, {
    basis: "estimated",
    evidenceIds: [],
    assumptions: ["Blended $0.10 / 1M tokens; provider billing may differ."],
  });
}
