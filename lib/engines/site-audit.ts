import type { AuditIssue, Severity, TechnicalPageObservation } from "@/lib/domain/types";
import { bandFor, type ReadinessBand, type ReadinessMetrics } from "./readiness";
import { SEVERITY } from "@/lib/engines/scoring-constants";

export interface PageAudit {
  url: string;
  finalUrl: string;
  title: string | null;
  ok: boolean;
  error?: string;
  metrics: ReadinessMetrics;
  issues: AuditIssue[];
  /** Present when the page was successfully crawled — feeds inventory engines. */
  observation?: TechnicalPageObservation;
  robotsDirectives?: string;
}

export interface TopIssue {
  ruleId: string;
  title: string;
  severity: Severity;
  count: number;
}

export interface WorstPage {
  url: string;
  title: string | null;
  score: number;
}

export interface SiteSummary {
  score: number;
  band: ReadinessBand;
  pagesScanned: number;
  pagesFailed: number;
  totalIssues: number;
  critical: number;
  high: number;
  quickWins: number;
  monitors: number;
  worstPages: WorstPage[];
  topIssues: TopIssue[];
}

/**
 * Aggregate per-page audits plus site-level issues (robots/sitemap) into one
 * honest site summary. Overall score is the mean of successfully-scanned page
 * scores; issue totals include site-level issues.
 */
export function aggregateSite(pages: PageAudit[], siteIssues: AuditIssue[] = []): SiteSummary {
  const ok = pages.filter((page) => page.ok);
  const scores = ok.map((page) => page.metrics.score);
  const score = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;

  const allIssues = [...ok.flatMap((page) => page.issues), ...siteIssues];
  const countBy = (severity: Severity) => allIssues.filter((issue) => issue.severity === severity).length;

  const grouped = new Map<string, TopIssue>();
  for (const issue of allIssues) {
    const existing = grouped.get(issue.ruleId);
    if (existing) existing.count += 1;
    else grouped.set(issue.ruleId, { ruleId: issue.ruleId, title: issue.title, severity: issue.severity, count: 1 });
  }
  const topIssues = [...grouped.values()]
    .sort((a, b) => SEVERITY[b.severity].rank * b.count - SEVERITY[a.severity].rank * a.count)
    .slice(0, 8);

  const worstPages = [...ok]
    .sort((a, b) => a.metrics.score - b.metrics.score)
    .slice(0, 5)
    .map((page) => ({ url: page.finalUrl, title: page.title, score: page.metrics.score }));

  return {
    score,
    band: bandFor(score),
    pagesScanned: ok.length,
    pagesFailed: pages.length - ok.length,
    totalIssues: allIssues.length,
    critical: countBy("critical"),
    high: countBy("high"),
    quickWins: countBy("quick-win"),
    monitors: countBy("monitor"),
    worstPages,
    topIssues,
  };
}
