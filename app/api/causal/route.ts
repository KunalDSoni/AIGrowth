// app/api/causal/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { runCausalTest } from "@/lib/causal/engine";
import type { OutcomeStreamProvider } from "@/lib/causal/outcomes";
import type { OutcomeSeries } from "@/lib/causal/types";

const outcomePoint = z.object({
  period: z.string(),
  value: z.number(),
  n: z.number().optional(),
});
const outcomeSeries = z.object({
  unit: z.enum(["conversions", "revenue", "clicks", "signups"]),
  points: z.array(outcomePoint),
});
const bodySchema = z.object({
  intervention: z.object({
    id: z.string(),
    channel: z.string(),
    hypothesis: z.string(),
    startedAt: z.string(),
    endedAt: z.string().optional(),
    geoScope: z.string().optional(),
    spendDeltaUsd: z.number().optional(),
  }),
  constraints: z.object({
    markets: z.number(),
    dailyOutcomeVolume: z.number(),
    canPulseBudget: z.boolean(),
  }),
  treatSeries: outcomeSeries,
  controlSeries: outcomeSeries,
  windowDays: z.number().optional(),
});

export async function POST(request: Request): Promise<Response> {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const treat = parsed.treatSeries as OutcomeSeries;
  const control = parsed.controlSeries as OutcomeSeries;
  const provider: OutcomeStreamProvider = {
    async fetch(scope) {
      return scope.geoScope === parsed.intervention.geoScope ? treat : control;
    },
  };

  const report = await runCausalTest({
    intervention: parsed.intervention,
    constraints: parsed.constraints,
    outcomes: provider,
    controlScope: "__control__",
    windowDays: parsed.windowDays,
  });
  return NextResponse.json(report);
}
