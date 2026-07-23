import { SafeWebsiteCrawler } from "@/lib/providers/crawler";
import { auditCrawledPage } from "@/lib/engines/live-audit";
import { computeReadiness } from "@/lib/engines/readiness";
import { parseSitemap, sameOriginUnique } from "@/lib/engines/sitemap";
import { aggregateSite, type PageAudit } from "@/lib/engines/site-audit";
import type { AuditIssue, CrawledPageEvidence } from "@/lib/domain/types";
import type { SeoResult } from "@/lib/analyze/types";

const MAX_PAGES = Number(process.env.SCAN_MAX_PAGES ?? 20);
const CONCURRENCY = Number(process.env.SCAN_CONCURRENCY ?? 5);
const PAGE_TIMEOUT = Number(process.env.CRAWLER_TIMEOUT_MS ?? 8000);
const PAGE_MAX_BYTES = Number(process.env.CRAWLER_MAX_BYTES ?? 500_000);

export interface SeoScanDeps {
  crawler?: SafeWebsiteCrawler;
  fetchText?: (url: string, timeoutMs: number) => Promise<{ ok: boolean; text: string }>;
}

async function defaultFetchText(url: string, timeoutMs: number): Promise<{ ok: boolean; text: string }> {
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
  return {
    url: crawl.url,
    finalUrl: crawl.finalUrl,
    title: crawl.title ?? null,
    ok: true,
    metrics: computeReadiness(issues),
    issues,
  };
}

function siteIssue(
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

export interface SeoScanFull extends SeoResult {
  home: CrawledPageEvidence;
  sitemapUrlCount: number;
}

export async function runSeoScan(url: string, deps: SeoScanDeps = {}): Promise<SeoScanFull> {
  const crawler = deps.crawler ?? new SafeWebsiteCrawler();
  const fetchText = deps.fetchText ?? defaultFetchText;

  const home = await crawler.crawl(url, { timeoutMs: PAGE_TIMEOUT, maxBytes: PAGE_MAX_BYTES });
  const origin = new URL(home.finalUrl).origin;

  const [robots, rootSitemap] = await Promise.all([
    fetchText(`${origin}/robots.txt`, 4000),
    fetchText(`${origin}/sitemap.xml`, 5000),
  ]);

  const siteIssues: AuditIssue[] = [];
  const sitemapFromRobots = robots.text.match(/sitemap:\s*(\S+)/i)?.[1];
  if (!robots.ok) {
    siteIssues.push(
      siteIssue(
        "robots-txt-missing",
        "monitor",
        "indexability",
        "Site has no robots.txt",
        "No robots.txt was reachable at the site root.",
        "Add a robots.txt with a Sitemap: directive.",
      ),
    );
  }

  let sitemapXml = rootSitemap.ok ? rootSitemap.text : "";
  if (!sitemapXml && sitemapFromRobots) {
    const alt = await fetchText(sitemapFromRobots, 5000);
    if (alt.ok) sitemapXml = alt.text;
  }
  if (!sitemapXml) {
    siteIssues.push(
      siteIssue(
        "sitemap-missing",
        "monitor",
        "indexability",
        "No sitemap.xml found",
        "No sitemap.xml was reachable or referenced in robots.txt.",
        "Generate a sitemap.xml listing every indexable page.",
      ),
    );
  }

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

  return {
    home,
    site,
    pages,
    siteIssues,
    scannedAt: home.observedAt,
    finalUrl: home.finalUrl,
    origin,
    sitemapUrlCount: candidates.length,
  };
}
