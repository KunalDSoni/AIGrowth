import type { AuditIssue, Severity } from "@/lib/domain/types";
import { READINESS_BANDS, SEVERITY } from "@/lib/engines/scoring-constants";

/**
 * Growth-readiness scoring. This is a REAL computation over the audit issues
 * produced by the SEO rule engine for a crawled page — not a hardcoded number.
 * Score starts at 100 and each issue subtracts a severity-weighted penalty.
 * The penalties and band cutoffs live in the documented scoring registry.
 */

export type ReadinessBand = "excellent" | "good" | "fair" | "poor";

export interface ReadinessMetrics {
  score: number;
  band: ReadinessBand;
  total: number;
  critical: number;
  high: number;
  monitor: number;
  quickWins: number;
}

export function bandFor(score: number): ReadinessBand {
  return (READINESS_BANDS.find((b) => score >= b.min) ?? READINESS_BANDS[READINESS_BANDS.length - 1]!).band;
}

export function computeReadiness(issues: AuditIssue[]): ReadinessMetrics {
  const penalty = issues.reduce((sum, issue) => sum + (SEVERITY[issue.severity]?.scorePenalty ?? 1), 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const count = (severity: Severity) => issues.filter((issue) => issue.severity === severity).length;
  const critical = count("critical");
  const high = count("high");
  const monitor = count("monitor");
  const quickWins = count("quick-win");
  return { score, band: bandFor(score), total: issues.length, critical, high, monitor, quickWins };
}
