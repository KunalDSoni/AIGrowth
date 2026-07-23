import { NextResponse } from "next/server";
import { getSearchOpportunityProvider } from "@/lib/providers/search";
import { buildDemandProxy } from "@/lib/engines/demand-proxy";
import { businessProfile } from "@/lib/data/demo";

export const runtime = "nodejs";

// SEARCH-001 — ranked prompt/topic opportunities from the configured demand provider.
export async function GET() {
  const provider = getSearchOpportunityProvider();
  try {
    const signals = await provider.discover({
      services: businessProfile.services,
      audiences: businessProfile.audienceSegments,
      market: businessProfile.market,
    });
    const opportunities = buildDemandProxy({ signals, business: businessProfile });
    return NextResponse.json({
      source: provider.source,
      simulated: provider.source === "demo",
      estimated: signals.some((s) => s.isEstimated),
      opportunities,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search provider failed";
    return NextResponse.json({ error: message, source: provider.source }, { status: 502 });
  }
}
