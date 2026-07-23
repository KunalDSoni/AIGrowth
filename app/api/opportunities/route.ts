import { NextResponse } from "next/server";
import { getSearchOpportunityProvider } from "@/lib/providers/search";
import { buildDemandProxy } from "@/lib/engines/demand-proxy";
import { inferBusinessProfile } from "@/lib/engines/live-intelligence";
import { domainKey, getProjectStore } from "@/lib/projects/store";

export const runtime = "nodejs";

/**
 * SEARCH-001 — ranked prompt/topic opportunities for a scanned domain.
 *
 * Requires a real prior scan. There is no bundled sample project, so a domain
 * that has never been analysed returns 409 rather than a stand-in.
 */
export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "A domain is required.", opportunities: [] }, { status: 400 });
  }

  const latest = await getProjectStore().loadLatest(domainKey(domain));
  if (!latest) {
    return NextResponse.json(
      { error: `No analysis for ${domain}. Run a scan first.`, needsScan: true, opportunities: [] },
      { status: 409 },
    );
  }

  const business = inferBusinessProfile(latest);
  const provider = getSearchOpportunityProvider();
  try {
    const signals = await provider.discover({
      services: business.services,
      audiences: business.audienceSegments,
      market: business.market,
    });
    return NextResponse.json({
      source: provider.source,
      estimated: signals.some((s) => s.isEstimated),
      opportunities: buildDemandProxy({ signals, business }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search provider failed";
    return NextResponse.json(
      { error: message, source: provider.source, opportunities: [] },
      { status: 502 },
    );
  }
}
