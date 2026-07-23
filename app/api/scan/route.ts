import { NextResponse } from "next/server";
import { z } from "zod";
import { publicWebsiteSchema } from "@/lib/security/url";
import { SafeWebsiteCrawler } from "@/lib/providers/crawler";
import { auditCrawledPage } from "@/lib/engines/live-audit";
import { computeReadiness } from "@/lib/engines/readiness";
import { parseSitemap, sameOriginUnique } from "@/lib/engines/sitemap";
import { aggregateSite, type PageAudit } from "@/lib/engines/site-audit";
import type { AuditIssue, CrawledPageEvidence } from "@/lib/domain/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({ url: publicWebsiteSchema });

const MAX_PAGES = Number(process.env.SCAN_MAX_PAGES ?? 20);
const CONCURRENCY = Number(process.env.SCAN_CONCURRENCY ?? 5);
const PAGE_TIMEOUT = Number(process.env.CRAWLER_TIMEOUT_MS ?? 8000);
const PAGE_MAX_BYTES = Number(process.env.CRAWLER_MAX_BYTES ?? 500_000);

async function fetchText(url: string, timeoutMs: number): Promise<{ ok: boolean; text: string }> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "OpenGrowthAI-DemoCrawler/0.1 (+https://opengrowth.ai)" },
    });
    if (!response.ok) return { ok: false, text: "" };
    return { ok: true, text: (await response.text()).slice(0, 200_000) };
  } catch {
    return { ok: false, text: "" };
  }
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function pageFromCrawl(crawl: CrawledPageEvidence): PageAudit {
  const issues = auditCrawledPage(crawl);
  return { url: crawl.url, finalUrl: crawl.finalUrl, title: crawl.title ?? null, ok: true, metrics: computeReadiness(issues), issues };
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid URL" }, { status: 400 });
  }

  try {
    const crawler = new SafeWebsiteCrawler();
    const home = await crawler.crawl(parsed.data.url, { timeoutMs: PAGE_TIMEOUT, maxBytes: PAGE_MAX_BYTES });
    const origin = new URL(home.finalUrl).origin;

    // Site-level checks (once): robots.txt and sitemap.xml over HTTP.
    const [robots, rootSitemap] = await Promise.all([
      fetchText(`${origin}/robots.txt`, 4000),
      fetchText(`${origin}/sitemap.xml`, 5000),
    ]);

    const siteIssues: AuditIssue[] = [];
    const sitemapFromRobots = robots.text.match(/sitemap:\s*(\S+)/i)?.[1];
    if (!robots.ok) {
      siteIssues.push(issue("robots-txt-missing", "monitor", "indexability", "Site has no robots.txt", "No robots.txt was reachable at the site root.", "Add a robots.txt with a Sitemap: directive."));
    }

    // Resolve sitemap: prefer /sitemap.xml, else the one referenced by robots.txt.
    let sitemapXml = rootSitemap.ok ? rootSitemap.text : "";
    if (!sitemapXml && sitemapFromRobots) {
      const alt = await fetchText(sitemapFromRobots, 5000);
      if (alt.ok) sitemapXml = alt.text;
    }
    if (!sitemapXml) {
      siteIssues.push(issue("sitemap-missing", "monitor", "indexability", "No sitemap.xml found", "No sitemap.xml was reachable or referenced in robots.txt.", "Generate a sitemap.xml listing every indexable page."));
    }

    // Collect page URLs from the sitemap (resolve one level of sitemap index).
    let sitemapPages: string[] = [];
    if (sitemapXml) {
      const parsedSitemap = parseSitemap(sitemapXml);
      if (parsedSitemap.sitemaps.length > 0) {
        const children = await mapLimit(parsedSitemap.sitemaps.slice(0, 5), 3, (u) => fetchText(u, 5000));
        sitemapPages = children.filter((c) => c.ok).flatMap((c) => parseSitemap(c.text).pages);
      } else {
        sitemapPages = parsedSitemap.pages;
      }
    }

    // Build the crawl target list: homepage first, then unique same-origin sitemap URLs.
    const candidates = sameOriginUnique([home.finalUrl, ...sitemapPages], origin);
    const targets = candidates.slice(0, MAX_PAGES);

    const pages = await mapLimit<string, PageAudit>(targets, CONCURRENCY, async (target) => {
      if (target === home.finalUrl) return pageFromCrawl(home);
      try {
        const crawl = await crawler.crawl(target, { timeoutMs: PAGE_TIMEOUT, maxBytes: PAGE_MAX_BYTES });
        return pageFromCrawl(crawl);
      } catch (error) {
        return {
          url: target,
          finalUrl: target,
          title: null,
          ok: false,
          error: error instanceof Error ? error.message : "Crawl failed",
          metrics: computeReadiness([]),
          issues: [],
        };
      }
    });

    const site = aggregateSite(pages, siteIssues);

    return NextResponse.json({
      url: parsed.data.url,
      finalUrl: home.finalUrl,
      origin,
      crawledAt: home.observedAt,
      sitemapUrlCount: candidates.length,
      site,
      siteIssues,
      pages: pages.map((page) => ({
        url: page.finalUrl,
        title: page.title,
        ok: page.ok,
        error: page.error ?? null,
        score: page.metrics.score,
        band: page.metrics.band,
        critical: page.metrics.critical,
        high: page.metrics.high,
        total: page.metrics.total,
        issues: page.issues,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    return NextResponse.json({ error: message }, { status: 200 });
  }
}

function issue(
  ruleId: string,
  severity: AuditIssue["severity"],
  impactArea: AuditIssue["impactArea"],
  title: string,
  description: string,
  recommendedAction: string,
): AuditIssue {
  return {
    id: `site-${ruleId}`,
    ruleId,
    category: ruleId.split("-")[0] ?? "site",
    severity,
    title,
    description,
    recommendedAction,
    affectedPages: 1,
    evidenceIds: ["ev-live-crawl-page"],
    impactArea,
  };
}
