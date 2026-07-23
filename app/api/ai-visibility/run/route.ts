import { NextResponse } from "next/server";
import { domainKey, getProjectStore } from "@/lib/projects/store";

export const runtime = "nodejs";

/**
 * AIV-002 — latest real answer-engine observation run for a scanned domain.
 *
 * Previously returned a bundled simulated run. It now reports only what was
 * actually observed; an unscanned domain yields nothing.
 */
export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "A domain is required.", run: null }, { status: 400 });
  }

  const latest = await getProjectStore().loadLatest(domainKey(domain));
  if (!latest) {
    return NextResponse.json(
      { error: `No analysis for ${domain}. Run a scan first.`, needsScan: true, run: null },
      { status: 409 },
    );
  }

  return NextResponse.json({
    run: {
      runId: latest.geo.runId,
      model: latest.geo.model,
      sampleSize: latest.geo.sampleSize,
      observations: latest.geo.observations,
      errors: latest.geo.errors,
    },
    summary: {
      brandMentionRate: latest.geo.brandMentionRate,
      firstPartyCitationShare: latest.geo.firstPartyCitationShare,
    },
  });
}
