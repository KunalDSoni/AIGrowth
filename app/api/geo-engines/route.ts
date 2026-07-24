import { NextResponse } from "next/server";
import { domainKey, getProjectStore } from "@/lib/projects/store";
import { getConfiguredEngines } from "@/lib/engines/geo-engine-registry";
import { runMultiEngineProbes } from "@/lib/engines/geo-multi-engine";
import { buildCrossEngineLedger } from "@/lib/engines/geo-cross-engine-ledger";
import { buildEngineTargetPlan } from "@/lib/engines/geo-engine-targets";
import { saveEngineProbes } from "@/lib/engines/geo-engine-probe-store";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * GIL-ME-5 — Cross-engine visibility for a scanned domain.
 *
 * Re-probes the scan's prompt universe across every configured answer engine
 * (Mock always; Perplexity/OpenAI/Gemini when their keys are set) and returns a
 * cross-engine ledger. Offline it is Mock-only, clearly simulated. An un-analysed
 * domain returns 409, never stand-in data.
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

  const prompts = latest.geo.observations.map((o) => o.prompt).filter(Boolean);
  if (prompts.length === 0) {
    return NextResponse.json({ error: "No prompts in the latest scan to probe.", report: null }, { status: 409 });
  }

  try {
    const results = await runMultiEngineProbes({
      engines: getConfiguredEngines(),
      prompts,
      brandGuess: latest.project.brandGuess,
      domain: domainKey(domain),
    });
    // Persist the raw per-engine probes so the per-engine fix route (EP-2) can
    // build engine-tailored fixes without re-probing.
    saveEngineProbes(domainKey(domain), results);
    const report = buildCrossEngineLedger(results);
    return NextResponse.json({ report, targetPlan: buildEngineTargetPlan(report) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build cross-engine ledger";
    return NextResponse.json({ error: message, report: null }, { status: 500 });
  }
}
