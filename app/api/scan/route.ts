import { NextResponse } from "next/server";
import { z } from "zod";
import { publicWebsiteSchema } from "@/lib/security/url";
import { SafeWebsiteCrawler } from "@/lib/providers/crawler";
import { SeoEngineAuditProvider } from "@/lib/providers/seo-engine";
import { computeReadiness } from "@/lib/engines/readiness";

export const runtime = "nodejs";

const schema = z.object({ url: publicWebsiteSchema });

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
    const issues = new SeoEngineAuditProvider().auditHtml(parsed.data.url, crawl.rawHtml ?? "", crawl);
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
    // 200 with an error field so the client can show a friendly message.
    return NextResponse.json({ error: message }, { status: 200 });
  }
}
