import { NextResponse } from "next/server";
import { domainKey, getProjectStore } from "@/lib/projects/store";
import { getWebsiteCrawler, isRealCrawlEnabled } from "@/lib/providers/crawler";
import { loadEngineProbes } from "@/lib/engines/geo-engine-probe-store";
import { buildEngineFixReports } from "@/lib/engines/geo-engine-fix-reports";
import { loadLifts } from "@/lib/engines/geo-fix-store";
import { learnedFixWeights } from "@/lib/engines/geo-fix-bandit";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * GIL-EP-2 — Per-engine GEO citation fixes.
 *
 * Builds one engine-tailored fix report per engine where the brand has a gap,
 * from the persisted multi-engine probes (EP-1) and the latest scan. Fix
 * recommendations require a live crawl (OPENGROWTH_REAL_CRAWL); otherwise each
 * report is honestly diagnosis-only. Learned weights (OPS-5) are folded in.
 *
 * 409 when the domain was never analysed, or when cross-engine visibility has
 * not been run yet (no persisted per-engine probes) — never stand-in data.
 */
export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "A domain is required.", reports: null }, { status: 400 });
  }

  const latest = await getProjectStore().loadLatest(domainKey(domain));
  if (!latest) {
    return NextResponse.json(
      { error: `No analysis for ${domain}. Run a scan first.`, needsScan: true, reports: null },
      { status: 409 },
    );
  }

  const probes = loadEngineProbes(domain);
  if (probes.length === 0) {
    return NextResponse.json(
      { error: "Run cross-engine visibility first to gather per-engine probes.", needsEngines: true, reports: null },
      { status: 409 },
    );
  }

  try {
    const crawler = isRealCrawlEnabled() ? getWebsiteCrawler() : undefined;
    const weights = learnedFixWeights(loadLifts(domainKey(domain)));
    const reports = await buildEngineFixReports(latest, probes, { crawler, weights });
    return NextResponse.json({ reports });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build per-engine fixes";
    return NextResponse.json({ error: message, reports: null }, { status: 500 });
  }
}
