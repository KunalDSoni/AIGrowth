// app/api/wind-tunnel/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHeuristicDistiller } from "@/lib/windtunnel/distiller";
import { runWindTunnelReport } from "@/lib/windtunnel/engine";
import { createFakeResponder } from "@/tests/support/windtunnel-fixtures";

const evidenceItem = z.object({
  id: z.string(),
  source: z.enum(["review", "call_note", "ticket", "gsc_query", "won_loss"]),
  segment: z.string().optional(),
  text: z.string(),
  sentiment: z.enum(["positive", "negative", "neutral"]),
});
const variant = z.object({ id: z.string(), text: z.string() });
const stimulus = z.object({
  id: z.string(),
  kind: z.enum(["headline", "landing_page"]),
  variants: z.array(variant).min(2),
});
const bodySchema = z.object({
  evidence: z.array(evidenceItem),
  stimulus,
  samples: z.number().optional(),
});

export async function POST(request: Request): Promise<Response> {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const report = await runWindTunnelReport({
    evidence: parsed.evidence,
    stimulus: parsed.stimulus,
    distiller: createHeuristicDistiller(),
    responder: createFakeResponder(),
    samples: parsed.samples,
  });
  return NextResponse.json(report);
}
