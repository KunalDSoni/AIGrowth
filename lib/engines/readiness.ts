import type { AuditIssue, Severity } from "@/lib/domain/types";

/**
 * Growth-readiness scoring. This is a REAL computation over the audit issues
 * produced by the SEO rule engine for a crawled page — not a hardcoded number.
 * Score starts at 100 and each issue subtracts a severity-weighted penalty.
 */
const PENALTY: Record<Severity, number> = {
  critical: 15,
  high: 6,
  "quick-win": 3,
  monitor: 1,
  ignore: 0,
};

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
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

export function computeReadiness(issues: AuditIssue[]): ReadinessMetrics {
  const penalty = issues.reduce((sum, issue) => sum + (PENALTY[issue.severity] ?? 1), 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const count = (severity: Severity) => issues.filter((issue) => issue.severity === severity).length;
  const critical = count("critical");
  const high = count("high");
  const monitor = count("monitor");
  const quickWins = count("quick-win");
  return { score, band: bandFor(score), total: issues.length, critical, high, monitor, quickWins };
}
