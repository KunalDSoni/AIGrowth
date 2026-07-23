import { NextResponse } from "next/server";
import { latestObservationRun } from "@/lib/data/demo";
import { summarizeAIVisibility } from "@/lib/engines/ai-visibility";
import { aiVisibilityPromptFamilies } from "@/lib/data/demo";

export const runtime = "nodejs";

// AIV-002 — return the latest reproducible observation run and its summary.
export async function GET() {
  const run = latestObservationRun;
  const family = aiVisibilityPromptFamilies.find((f) => f.id === run.familyId);
  const summaries = family ? summarizeAIVisibility([family], run.observations) : [];
  return NextResponse.json({ run, summary: summaries[0] ?? null, simulated: true });
}
