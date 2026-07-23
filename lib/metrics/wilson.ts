import type { MetricInterval } from "@/lib/metrics/types";

/**
 * Wilson score interval. STUB — the real implementation lands in sub-project 2
 * (the statistical layer). The signature and call sites exist now so consumers
 * can be wired without a second refactor. Returns null meaning "no interval yet".
 */
export function wilsonInterval(_successes: number, _n: number): MetricInterval | null {
  return null;
}
