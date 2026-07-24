import { NextResponse } from "next/server";
import { domainKey, getProjectStore } from "@/lib/projects/store";
import { GeminiNotConfiguredError, GeminiVisibilityProvider } from "@/lib/providers/gemini-visibility";
import { runGeoProbes } from "@/lib/engines/run-geo";
import { findIntervention, saveLift } from "@/lib/engines/geo-fix-store";
import { measureFixLift } from "@/lib/engines/geo-measure-lift";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * OPS-3 — Measure the citation lift of a shipped fix.
 *
 * Body: { domain, interventionId, controlled? }. Re-probes the affected prompts
 * against the live answer engine, attributes lift vs the intervention baseline
 * (labelled causal only with a control), and persists it. Without a configured
 * answer engine it returns measured:false rather than fabricating a result.
 */
export async function POST(request: Request) {
  let body: { domain?: string; interventionId?: string; controlled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { domain, interventionId, controlled } = body;
  if (!domain || !interventionId) {
    return NextResponse.json({ error: "domain and interventionId are required." }, { status: 400 });
  }

  const latest = await getProjectStore().loadLatest(domainKey(domain));
  if (!latest) {
    return NextResponse.json({ error: `No analysis for ${domain}. Run a scan first.`, needsScan: true }, { status: 409 });
  }

  const intervention = findIntervention(domain, interventionId);
  if (!intervention) {
    return NextResponse.json({ error: `Intervention ${interventionId} not found.` }, { status: 404 });
  }

  // Resolve the affected prompt texts from the scan, preserving order.
  const byId = new Map(latest.geo.observations.map((o) => [o.id, o.prompt]));
  const pairs = intervention.affectedPrompts
    .map((id) => ({ id, text: byId.get(id) }))
    .filter((p): p is { id: string; text: string } => Boolean(p.text));
  if (pairs.length === 0) {
    return NextResponse.json({ error: "Affected prompts are not present in the latest scan." }, { status: 422 });
  }

  let provider: GeminiVisibilityProvider;
  try {
    provider = new GeminiVisibilityProvider();
  } catch (error) {
    if (error instanceof GeminiNotConfiguredError) {
      return NextResponse.json({
        measured: false,
        note: "Lift measurement requires a live answer engine. Configure GEMINI_API_KEY to re-probe.",
      });
    }
    throw error;
  }

  try {
    const geoResult = await runGeoProbes({
      brandGuess: latest.project.brandGuess,
      domain: domainKey(domain),
      services: [],
      provider,
      prompts: pairs.map((p) => p.text),
      runId: `geo-measure-${Date.now()}`,
    });
    const lift = measureFixLift({
      intervention,
      orderedPromptIds: pairs.map((p) => p.id),
      geoResult,
      controlled,
    });
    saveLift(domain, lift);
    return NextResponse.json({ measured: true, lift });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to measure lift";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
