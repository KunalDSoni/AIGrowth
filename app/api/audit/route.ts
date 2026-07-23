import { NextResponse } from "next/server";
import { z } from "zod";
import { publicWebsiteSchema } from "@/lib/security/url";
import { SeoEngineAuditProvider } from "@/lib/providers/seo-engine";
import { getWebsiteCrawler, isRealCrawlEnabled } from "@/lib/providers/crawler";
import { getAuditRunRepository } from "@/lib/repositories/audit-runs";
import { domainKey } from "@/lib/projects/store";
import type { EvidenceReference } from "@/lib/domain/types";

export const runtime = "nodejs";

const schema = z.object({ url: publicWebsiteSchema });

/**
 * Audits a real URL. There is no simulated fallback: if crawling is disabled or
 * fails, the request errors rather than returning invented issues.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid URL" },
      { status: 400 },
    );
  }

  if (!isRealCrawlEnabled()) {
    return NextResponse.json(
      {
        error: "Live crawling is disabled. Set OPENGROWTH_REAL_CRAWL=true to audit a site.",
        code: "NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const repository = getAuditRunRepository();
  const startedAt = new Date().toISOString();

  try {
    const crawl = await getWebsiteCrawler().crawl(parsed.data.url);
    const observedAt = new Date().toISOString();
    const evidence: Partial<EvidenceReference>[] = [
      {
        id: "ev-live-crawl-page",
        kind: "CRAWL_OBSERVATION",
        source: "SafeWebsiteCrawler",
        observedAt,
        retrievedAt: observedAt,
        reliability: "MEDIUM",
        isEstimated: false,
        isSimulated: false,
        summary: `Fetched ${crawl.finalUrl} and normalized ${crawl.wordCount} words, ${crawl.headings.length} headings, ${crawl.imageCount} images and ${crawl.internalLinkCount} internal links.`,
        normalizedValue: crawl,
      },
    ];
    const issues = new SeoEngineAuditProvider().auditHtml(
      parsed.data.url,
      crawl.rawHtml ?? "",
      crawl,
    );
    const run = await repository.save({
      projectId: domainKey(parsed.data.url),
      url: parsed.data.url,
      source: "safe-crawler-seo-engine",
      status: "completed",
      startedAt,
      completedAt: observedAt,
      simulatedIssues: false,
      issues,
      evidence,
      crawl,
    });
    return NextResponse.json({
      runId: run.id,
      issues,
      source: "safe-crawler-seo-engine",
      url: parsed.data.url,
      crawl,
      evidence,
      simulatedIssues: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Crawler failed";
    return NextResponse.json(
      { error: `Could not audit ${parsed.data.url}: ${message}`, url: parsed.data.url },
      { status: 502 },
    );
  }
}
