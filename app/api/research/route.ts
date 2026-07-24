import { NextResponse } from "next/server";
import { domainKey, getProjectStore } from "@/lib/projects/store";
import { buildCitationLedger } from "@/lib/engines/geo-citation-ledger";
import { buildResearchPlan } from "@/lib/engines/research-engine";
import { isRealCrawlEnabled } from "@/lib/providers/crawler";

export const runtime = "nodejs";

/**
 * PRE-6 — Proprietary Research Engine plan for a scanned domain.
 *
 * Turns the persisted GEO run's citation ledger into ranked study angles: the
 * niche gaps where an original statistic would get cited but no source owns the
 * answer. Angles are derived offline from real scan data. Composing a full study
 * additionally needs licensed datasets, so `canCompose` is gated on real-data
 * mode — offline the plan is honestly angles-only, never fabricated findings.
 * An un-analysed domain returns 409, never stand-in data.
 */
export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "A domain is required.", plan: null }, { status: 400 });
  }

  const latest = await getProjectStore().loadLatest(domainKey(domain));
  if (!latest) {
    return NextResponse.json(
      { error: `No analysis for ${domain}. Run a scan first.`, needsScan: true, plan: null },
      { status: 409 },
    );
  }

  try {
    const ledger = buildCitationLedger(latest.geo);
    const plan = buildResearchPlan(ledger, { canCompose: isRealCrawlEnabled() });
    return NextResponse.json({ plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build research plan";
    return NextResponse.json({ error: message, plan: null }, { status: 500 });
  }
}
