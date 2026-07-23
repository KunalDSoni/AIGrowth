import { NextResponse } from "next/server";
import { domainKey, getProjectStore } from "@/lib/projects/store";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";
import { buildGrowthIntelligenceReport } from "@/lib/engines/growth-intelligence-compose";

export const runtime = "nodejs";

/**
 * GIP — unified Growth Intelligence report for a scanned domain.
 *
 * Composes the six intelligence engines into one ranked, evidence-backed report.
 * Requires a real prior scan; an un-analysed domain returns 409 rather than any
 * stand-in data.
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
    // Reuse persisted live intelligence when present; otherwise derive it so the
    // report's citation gaps and honesty labels are populated from live evidence.
    const result = latest.intelligence
      ? latest
      : { ...latest, intelligence: buildLiveIntelligence(latest) };
    return NextResponse.json({ report: buildGrowthIntelligenceReport(result) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build report";
    return NextResponse.json({ error: message, report: null }, { status: 500 });
  }
}
