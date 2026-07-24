import { NextResponse } from "next/server";
import { domainKey, getProjectStore } from "@/lib/projects/store";
import { buildGeoFixReport } from "@/lib/engines/geo-fix-report";
import { getWebsiteCrawler, isRealCrawlEnabled } from "@/lib/providers/crawler";

export const runtime = "nodejs";

/**
 * GIL-06 — GEO Citation-Fix report for a scanned domain.
 *
 * Diagnosis (coverage, competitors beating you, absent prompts) is derived
 * offline from the persisted GEO run. Fix recommendations additionally require a
 * live crawl and only run when OPENGROWTH_REAL_CRAWL=true; otherwise the report
 * is honestly diagnosis-only. An un-analysed domain returns 409, never stand-in
 * data.
 */
export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "A domain is required.", report: null }, { status: 400 });
  }

  const latest = await getProjectStore().loadLatest(domainKey(domain));
  if (!latest) {
    return NextResponse.json(
      { error: `No analysis for ${domain}. Run a scan first.`, needsScan: true, report: null },
      { status: 409 },
    );
  }

  try {
    const crawler = isRealCrawlEnabled() ? getWebsiteCrawler() : undefined;
    const report = await buildGeoFixReport(latest, { crawler });
    return NextResponse.json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build GEO fix report";
    return NextResponse.json({ error: message, report: null }, { status: 500 });
  }
}
