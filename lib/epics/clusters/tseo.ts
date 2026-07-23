import type { EpicResult } from "@/lib/epics/registry";
import type { EpicContext } from "@/lib/epics/clusters/biz";
import type { AuditIssue } from "@/lib/domain/types";

function done(epicId: EpicResult["epicId"], summary: string, data: Record<string, unknown>): EpicResult {
  return { epicId, status: "done", summary, data };
}

function byImpact(issues: AuditIssue[], area: AuditIssue["impactArea"]) {
  return issues.filter((i) => i.impactArea === area);
}

function byRule(issues: AuditIssue[], prefix: string) {
  return issues.filter((i) => i.ruleId.startsWith(prefix) || i.ruleId.includes(prefix));
}

export function runTseoEpics(ctx: EpicContext): EpicResult[] {
  const { result, intelligence } = ctx;
  const issues: AuditIssue[] = [
    ...result.seo.siteIssues,
    ...result.seo.pages.filter((p) => p.ok).flatMap((p) => p.issues),
  ];

  const grouped = new Map<string, { ruleId: string; title: string; count: number; severity: string }>();
  for (const issue of issues) {
    const g = grouped.get(issue.ruleId);
    if (g) g.count += 1;
    else grouped.set(issue.ruleId, { ruleId: issue.ruleId, title: issue.title, count: 1, severity: issue.severity });
  }

  const contract = {
    version: "live-audit-v1",
    fields: ["ruleId", "severity", "impactArea", "evidenceIds", "recommendedAction"],
    issueCount: issues.length,
  };

  const recInputs = [...grouped.values()].map((g) => ({
    candidateId: `seo-${g.ruleId}`,
    title: g.title,
    severity: g.severity,
    count: g.count,
  }));

  return [
    done("TSEO-001", "Audit rule contract", contract),
    done("TSEO-002", "Crawlability checks", {
      issues: byRule(issues, "broken").concat(byImpact(issues, "discovery")).slice(0, 20),
      siteIssues: result.seo.siteIssues.filter((i) => /robot|sitemap|crawl/i.test(i.ruleId + i.title)),
    }),
    done("TSEO-003", "Indexability checks", { issues: byImpact(issues, "indexability") }),
    done("TSEO-004", "Metadata checks", { issues: byImpact(issues, "metadata") }),
    done("TSEO-005", "Heading and content structure", {
      issues: byRule(issues, "h1").concat(byRule(issues, "thin")).concat(byRule(issues, "word")),
      pages: result.seo.pages.filter((p) => p.ok).map((p) => ({
        url: p.finalUrl,
        h1Count: p.observation?.h1Count,
        wordCount: p.observation?.wordCount,
      })),
    }),
    done("TSEO-006", "Image SEO checks", {
      issues: byImpact(issues, "accessibility").filter((i) => /alt|image/i.test(i.ruleId + i.title)),
      imagesMissingAlt: result.seo.pages.filter((p) => p.ok).reduce((n, p) => n + (p.observation?.imagesMissingAlt ?? 0), 0),
    }),
    done("TSEO-007", "Structured data checks", {
      issues: byImpact(issues, "structured-data"),
      pagesWithSchema: result.seo.pages.filter((p) => p.ok && p.observation?.hasStructuredData).length,
    }),
    done("TSEO-008", "Internal link health", {
      issues: byImpact(issues, "internal-linking"),
      avgInternalLinks:
        result.seo.pages.filter((p) => p.ok).reduce((n, p) => n + (p.observation?.internalLinkCount ?? 0), 0) /
        Math.max(1, result.seo.pages.filter((p) => p.ok).length),
    }),
    done("TSEO-009", "Mobile and accessibility basics", {
      viewportOk: result.seo.pages.filter((p) => p.ok && p.observation?.hasViewport).length,
      issues: byImpact(issues, "accessibility"),
    }),
    done("TSEO-010", "Duplicate content and template detection", {
      duplicateTitles: (() => {
        const map = new Map<string, number>();
        for (const p of result.seo.pages.filter((page) => page.ok && page.title)) {
          const title = p.title!;
          map.set(title, (map.get(title) ?? 0) + 1);
        }
        return [...map.entries()].filter(([, n]) => n > 1).map(([title, count]) => ({ title, count }));
      })(),
    }),
    done("TSEO-011", "Issue grouping and deduplication", { groups: [...grouped.values()].sort((a, b) => b.count - a.count) }),
    done("TSEO-012", "Technical SEO recommendation inputs", {
      candidates: recInputs,
      aiAccess: intelligence.aiAccess,
    }),
  ];
}
