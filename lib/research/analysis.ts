// lib/research/analysis.ts
import type { Dataset, Methodology, StudyFinding } from "./types";
import { metricConfidence, wilsonInterval } from "@/lib/metrics/wilson";

export function analyze(dataset: Dataset, methodology: Methodology): StudyFinding {
  const n = dataset.observations.length;
  const k = dataset.observations.filter((o) => o.matched).length;
  const interval = wilsonInterval(k, n) ?? { low: 0, high: 100, method: "wilson" as const };
  const value = n > 0 ? (k / n) * 100 : 0;
  const confidence = metricConfidence(interval, { n, minReliable: methodology.minSampleSize });
  const rounded = Math.round(value);
  return {
    question: methodology.question,
    headlineStat: `${rounded}% — ${methodology.question}`,
    value,
    interval: { low: interval.low, high: interval.high },
    n,
    source: dataset.provenance.source,
    method: methodology.method,
    confidence,
  };
}
