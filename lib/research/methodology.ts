// lib/research/methodology.ts
import type { Dataset, Methodology, MethodologyCheck } from "./types";
import { validateProvenance } from "./sourcer";
import { wilsonInterval } from "@/lib/metrics/wilson";

const DIRECTIONAL_WIDTH_PP = 30;

export function preRegister(
  question: string,
  metric: string,
  minSampleSize: number,
  at: string,
): Methodology {
  return { question, metric, method: "proportion", preRegisteredAt: at, minSampleSize };
}

export function checkSupport(dataset: Dataset, methodology: Methodology): MethodologyCheck {
  const provenance = validateProvenance(dataset);
  if (!provenance.ok) {
    return { verdict: "unlicensed", reason: provenance.reason };
  }
  const n = dataset.observations.length;
  if (n < methodology.minSampleSize) {
    return { verdict: "insufficient", reason: `n=${n} below minimum ${methodology.minSampleSize}.` };
  }
  const k = dataset.observations.filter((o) => o.matched).length;
  const interval = wilsonInterval(k, n);
  if (!interval) {
    return { verdict: "insufficient", reason: "Interval could not be computed." };
  }
  const width = interval.high - interval.low;
  if (width > DIRECTIONAL_WIDTH_PP) {
    return { verdict: "directional", reason: `Interval width ${width.toFixed(1)}pp — report as directional.` };
  }
  return { verdict: "supported", reason: `n=${n}, interval width ${width.toFixed(1)}pp.` };
}
