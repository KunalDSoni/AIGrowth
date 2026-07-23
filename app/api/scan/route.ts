import { NextResponse } from "next/server";
import { z } from "zod";
import { publicWebsiteSchema } from "@/lib/security/url";
import { runSeoScan } from "@/lib/engines/run-seo-scan";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({ url: publicWebsiteSchema });

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid URL" }, { status: 400 });
  }

  try {
    const result = await runSeoScan(parsed.data.url);
    return NextResponse.json({
      url: parsed.data.url,
      finalUrl: result.finalUrl,
      origin: result.origin,
      crawledAt: result.scannedAt,
      sitemapUrlCount: result.sitemapUrlCount,
      site: result.site,
      siteIssues: result.siteIssues,
      pages: result.pages.map((page) => ({
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
