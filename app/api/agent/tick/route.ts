import { NextResponse } from "next/server";
import { PrismaRuntimeStore } from "@/lib/agents/prisma-store";
import { runTick } from "@/lib/agents/tick";
import { buildLiveRegistry, LIVE_PIPELINE } from "@/lib/agents/wiring";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.AGENT_TICK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "AGENT_TICK_SECRET is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await runTick({
      store: new PrismaRuntimeStore(),
      registry: buildLiveRegistry(),
      pipeline: LIVE_PIPELINE,
      maxClients: Number(process.env.AGENT_TICK_MAX_CLIENTS ?? 5),
      leaseMs: Number(process.env.AGENT_TICK_LEASE_MS ?? 120_000),
    });
    return NextResponse.json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tick failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
