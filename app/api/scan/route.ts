import { NextResponse } from "next/server";
import { z } from "zod";
import { publicWebsiteSchema } from "@/lib/security/url";
import { SafeWebsiteCrawler } from "@/lib/providers/crawler";
import { auditCrawledPage, type LiveAuditContext } from "@/lib/engines/live-audit";
import { computeReadiness } from "@/lib/engines/readiness";

export const runtime = "nodejs";

const schema = z.object({ url: publicWebsiteSchema });

async function fetchText(url: string, timeoutMs: number): Promise<{ ok: boolean; text: string }> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "OpenGrowthAI-DemoCrawler/0.1 (+https://opengrowth.ai)" },
    });
    if (!response.ok) return { ok: false, text: "" };
    const text = await response.text();
    return { ok: true, text: text.slice(0, 100_000) };
  } catch {
    return { ok: false, text: "" };
  }
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid URL" }, { status: 400 });
  }

  try {
    const crawler = new SafeWebsiteCrawler();
    const crawl = await crawler.crawl(parsed.data.url, {
      timeoutMs: Number(process.env.CRAWLER_TIMEOUT_MS ?? 8000),
      maxBytes: Number(process.env.CRAWLER_MAX_BYTES ?? 500_000),
    });

    // Real robots.txt / sitemap.xml checks over HTTP (same origin, already validated).
    const origin = new URL(crawl.finalUrl).origin;
    const [robots, sitemap] = await Promise.all([
      fetchText(`${origin}/robots.txt`, 4000),
      fetchText(`${origin}/sitemap.xml`, 4000),
    ]);
    const ctx: LiveAuditContext = {
      robotsTxt: robots.ok ? robots.text : null,
      sitemapFound: sitemap.ok || /sitemap:/i.test(robots.text),
    };

    const issues = auditCrawledPage(crawl, ctx);
    const metrics = computeReadiness(issues);

    return NextResponse.json({
      url: parsed.data.url,
      finalUrl: crawl.finalUrl,
      crawledAt: crawl.observedAt,
      crawl: {
        title: crawl.title ?? null,
        description: crawl.description ?? null,
        statusCode: crawl.statusCode,
        wordCount: crawl.wordCount,
        headings: crawl.headings.length,
        h1Count: crawl.h1Count,
        images: crawl.imageCount,
        imagesMissingAlt: crawl.imagesMissingAlt,
        internalLinks: crawl.internalLinkCount,
        externalLinks: crawl.externalLinkCount ?? 0,
        hasViewport: crawl.hasViewport,
        hasStructuredData: crawl.hasStructuredData,
      },
      metrics,
      issues,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    return NextResponse.json({ error: message }, { status: 200 });
  }
}
