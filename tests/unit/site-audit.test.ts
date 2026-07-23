import { describe, expect, it } from "vitest";
import { aggregateSite, type PageAudit } from "@/lib/engines/site-audit";
import { computeReadiness } from "@/lib/engines/readiness";
import type { AuditIssue, Severity } from "@/lib/domain/types";

function issue(ruleId: string, severity: Severity): AuditIssue {
  return {
    id: `i-${ruleId}`,
    ruleId,
    category: "x",
    severity,
    title: `${ruleId} title`,
    description: "d",
    recommendedAction: "a",
    affectedPages: 1,
    evidenceIds: [],
    impactArea: "metadata",
  };
}

function page(url: string, issues: AuditIssue[], ok = true): PageAudit {
  return { url, finalUrl: url, title: url, ok, error: ok ? undefined : "failed", metrics: computeReadiness(issues), issues };
}

describe("aggregateSite", () => {
  it("averages page scores and ignores failed pages in the mean", () => {
    const summary = aggregateSite([
      page("https://x.com/a", []), // 100
      page("https://x.com/b", [issue("title-short", "high")]), // 94
      page("https://x.com/c", [], false), // failed, excluded
    ]);
    expect(summary.score).toBe(Math.round((100 + 94) / 2));
    expect(summary.pagesScanned).toBe(2);
    expect(summary.pagesFailed).toBe(1);
  });

  it("counts issues across pages plus site issues", () => {
    const summary = aggregateSite(
      [page("https://x.com/a", [issue("h1-missing", "high")]), page("https://x.com/b", [issue("thin-content", "monitor")])],
      [issue("robots-txt-missing", "monitor")],
    );
    expect(summary.totalIssues).toBe(3);
    expect(summary.high).toBe(1);
    expect(summary.quickWins).toBe(2); // two monitors
  });

  it("ranks worst pages first and surfaces top issues", () => {
    const summary = aggregateSite([
      page("https://x.com/good", []),
      page("https://x.com/bad", [issue("title-missing", "critical"), issue("h1-missing", "high")]),
    ]);
    expect(summary.worstPages[0]?.url).toBe("https://x.com/bad");
    expect(summary.topIssues[0]?.severity).toBe("critical");
  });
});
