// app/api/research/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { findAngles } from "@/lib/research/angles";
import { preRegister } from "@/lib/research/methodology";
import { runStudy } from "@/lib/research/engine";
import { createFixtureProvider } from "@/tests/support/research-fixtures";
import type { Dataset } from "@/lib/research/types";

const gap = z.object({
  question: z.string(),
  topic: z.string(),
  askVolume: z.number(),
  existingSources: z.number(),
});
const observation = z.object({ matched: z.boolean() });
const dataset = z.object({
  id: z.string(),
  provenance: z.object({
    source: z.string(),
    license: z.enum(["open", "public_domain", "cc_by", "proprietary_first_party", "unknown"]),
    retrievedAt: z.string(),
  }),
  observations: z.array(observation),
  population: z.string().optional(),
  sampleFrame: z.string().optional(),
});
const bodySchema = z.object({
  gaps: z.array(gap).min(1),
  dataset,
  minSampleSize: z.number().optional(),
});

export async function POST(request: Request): Promise<Response> {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const angles = findAngles(parsed.gaps);
  const top = angles[0];
  const methodology = preRegister(top.question, "primary_metric", parsed.minSampleSize ?? 30, new Date().toISOString());
  const study = await runStudy({
    angle: top,
    methodology,
    provider: createFixtureProvider(parsed.dataset as Dataset),
  });
  return NextResponse.json({ angles, study });
}
