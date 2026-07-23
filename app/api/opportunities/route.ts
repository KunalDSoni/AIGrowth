import { NextResponse } from "next/server";
import { DemoSearchProvider } from "@/lib/providers/search";
import { buildDemandProxy } from "@/lib/engines/demand-proxy";
import { businessProfile } from "@/lib/data/demo";

export const runtime = "nodejs";

// SEARCH-001 — ranked prompt/topic opportunities from the demo demand provider.
export async function GET() {
  const provider = new DemoSearchProvider();
  const signals = await provider.discover({
    services: businessProfile.services,
    audiences: businessProfile.audienceSegments,
    market: businessProfile.market,
  });
  const opportunities = buildDemandProxy({ signals, business: businessProfile });
  return NextResponse.json({ source: provider.source, simulated: true, opportunities });
}
