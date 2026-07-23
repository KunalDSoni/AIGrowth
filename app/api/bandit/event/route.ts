import { NextResponse } from "next/server";
import { z } from "zod";
import { getBanditStore } from "@/lib/bandit/store";
import { posteriorMeans, recordOutcome, trafficShares } from "@/lib/bandit/thompson";

export const runtime = "nodejs";

const schema = z.object({
  experiment: z.string().min(1).default("landing-cro-v1"),
  armId: z.string().min(1),
  converted: z.boolean(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const store = getBanditStore();
  const experiment = await store.getOrCreateDefault(parsed.data.experiment);

  // Respond quickly: update in-memory, persist after (still awaited for file durability in this slice).
  try {
    recordOutcome(experiment, parsed.data.armId, parsed.data.converted);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown arm" }, { status: 400 });
  }
  await store.save(experiment);

  return NextResponse.json({
    ok: true,
    armId: parsed.data.armId,
    converted: parsed.data.converted,
    trafficShares: trafficShares(experiment),
    posteriorMeans: posteriorMeans(experiment),
    arms: experiment.arms.map((a) => ({ id: a.id, label: a.label, alpha: a.alpha, beta: a.beta })),
  });
}
