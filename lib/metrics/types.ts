/**
 * A displayed number that carries its own meaning. A bare `number` can be
 * multiplied by 100 by accident; a Metric cannot — units and provenance are
 * part of the type, and rendering is owned by formatMetric.
 */

export type Unit = "percent" | "count" | "score" | "usd" | "hours" | "ratio" | "days";

export type MetricBasis =
  | "measured" // counted from real observations (crawl, GEO run, GSC)
  | "derived" // a formula over measured inputs (readiness score)
  | "estimated" // a labelled projection with stated assumptions AND evidence
  | "config"; // a governance constant (sub-project 4)

export interface MetricSample {
  n: number;
  minReliable: number;
}

export interface MetricInterval {
  low: number;
  high: number;
  method: "wilson";
}

export type MetricConfidence = "high" | "medium" | "low" | "insufficient";

export interface Metric<U extends Unit = Unit> {
  value: number;
  unit: U;
  basis: MetricBasis;
  /** Evidence records that justify it. Empty is a red flag, not a default. */
  evidenceIds: string[];
  sample?: MetricSample;
  interval?: MetricInterval;
  confidence?: MetricConfidence;
  /** Present only for estimated metrics; enforced at construction. */
  assumptions?: string[];
}
