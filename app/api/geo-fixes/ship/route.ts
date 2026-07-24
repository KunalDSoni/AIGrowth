import { NextResponse } from "next/server";
import { domainKey, getProjectStore } from "@/lib/projects/store";
import { shipFix } from "@/lib/engines/geo-fix-ship";
import { saveIntervention } from "@/lib/engines/geo-fix-store";
import type { CitationFix } from "@/lib/engines/geo-citation-fix";

export const runtime = "nodejs";

/**
 * OPS-2 — Ship an approved GEO citation fix.
 *
 * Body: { domain, fix, approvedBy }. Approves the fix through the human gate,
 * records an intervention with a baseline snapshot, and persists it. Never
 * auto-approves: a missing/blank approver or an un-analysed domain is rejected.
 */
export async function POST(request: Request) {
  let body: { domain?: string; fix?: CitationFix; approvedBy?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { domain, fix, approvedBy } = body;
  if (!domain || !fix || !approvedBy) {
    return NextResponse.json({ error: "domain, fix and approvedBy are required." }, { status: 400 });
  }

  const latest = await getProjectStore().loadLatest(domainKey(domain));
  if (!latest) {
    return NextResponse.json({ error: `No analysis for ${domain}. Run a scan first.`, needsScan: true }, { status: 409 });
  }

  try {
    const { intervention } = shipFix({ result: latest, fix, approvedBy });
    saveIntervention(domain, intervention);
    return NextResponse.json({ intervention });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to ship fix";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
