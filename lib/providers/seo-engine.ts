import os from "node:os";
import path from "node:path";
import { auditSite } from "@/lib/seo-engine/core/engine";
import { parseHtml } from "@/lib/seo-engine/core/parse";
import type { Finding, PageFacts, Site, SiteContext } from "@/lib/seo-engine/core/types";
import type { AuditIssue, CrawledPageEvidence } from "@/lib/domain/types";
import type { AuditProvider } from "./contracts";

const EVIDENCE_ID = "ev-live-crawl-page";

function impactFor(ruleId: string): AuditIssue["impactArea"] {
  if (ruleId.startsWith("metadata") || ruleId.startsWith("social")) return "metadata";
  if (ruleId.startsWith("schema")) return "structured-data";
  if (ruleId.startsWith("graph") || ruleId.startsWith("link") || ruleId.startsWith("page-")) {
    return "internal-linking";
  }
  if (ruleId.startsWith("media")) return "accessibility";
  if (ruleId.startsWith("ai")) return "discovery";
  if (ruleId.startsWith("robots") || ruleId.startsWith("sitemap") || ruleId.startsWith("canonical")) {
    return "indexability";
  }
  return "discovery";
}

function severityFor(severity: Finding["severity"]): AuditIssue["severity"] {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "high";
  return "monitor";
}

function buildSite(url: string, filePath: string): Site {
  return {
    id: "live-crawl",
    name: new URL(url).hostname,
    root: path.dirname(filePath),
    config: { origin: new URL(url).origin },
    htmlFiles: [filePath],
    excludedMirrorPages: 0,
    hasGit: false,
    robotsTxtPath: null,
    sitemapPath: null,
    notFoundPagePath: null,
  };
}

function buildContext(site: Site, page: PageFacts): SiteContext {
  return {
    site,
    pages: [page],
    byUrlPath: new Map([[page.urlPath, [page]]]),
    fileSet: new Set([page.filePath]),
  };
}

function toIssue(finding: Finding, pageCount: number): AuditIssue {
  const affectedPages = finding.relPath === null ? pageCount : 1;
  return {
    id: `engine-${finding.ruleId}-${finding.relPath ?? "site"}`,
    ruleId: finding.ruleId,
    category: finding.ruleId.split("-")[0] ?? "technical",
    severity: severityFor(finding.severity),
    title: finding.message,
    description: finding.context ? `${finding.message}: ${finding.context}` : finding.message,
    recommendedAction: finding.remedy ?? "Review this finding and update the affected page or site configuration.",
    affectedPages,
    evidenceIds: [EVIDENCE_ID],
    impactArea: impactFor(finding.ruleId),
  };
}

export class SeoEngineAuditProvider implements AuditProvider {
  async audit(url: string): Promise<AuditIssue[]> {
    throw new Error(`SeoEngineAuditProvider requires crawl evidence for ${url}`);
  }

  auditHtml(url: string, html: string, crawl: CrawledPageEvidence): AuditIssue[] {
    const filePath = path.join(os.tmpdir(), "opengrowth-live-crawl.html");
    const site = buildSite(url, filePath);
    const page = parseHtml(html, filePath, site);
    const audit = auditSite(buildContext(site, page));

    // Keep the product's crawl-derived page count available to the adapter even
    // though the current safe crawler intentionally audits one page at a time.
    void crawl;
    return audit.findings.map((finding) => toIssue(finding, audit.pageCount));
  }
}
