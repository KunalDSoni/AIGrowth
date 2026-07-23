import { NextResponse } from "next/server";
import { z } from "zod";
import { domainKey, getProjectStore } from "@/lib/projects/store";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";
import { buildMarketingOS, demoAnalyzeForMarketing } from "@/lib/marketing/os";
import type { AnalyzeResult } from "@/lib/analyze/types";

export const runtime = "nodejs";

const schema = z.object({
  domain: z.string().optional(),
  hoursPerWeek: z.number().min(1).max(40).optional(),
  useDemo: z.boolean().optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  let result: AnalyzeResult | null = null;
  if (parsed.data.domain && !parsed.data.useDemo) {
    const latest = await getProjectStore().loadLatest(domainKey(parsed.data.domain));
    if (latest) {
      result = latest;
      if (!result.intelligence) result.intelligence = buildLiveIntelligence(result);
    }
  }
  if (!result) result = demoAnalyzeForMarketing();
  if (!result.intelligence) result.intelligence = buildLiveIntelligence(result);

  const os = buildMarketingOS(result, { hoursPerWeek: parsed.data.hoursPerWeek ?? 8 });
  return NextResponse.json({
    source: parsed.data.useDemo || !parsed.data.domain ? "demo" : "live",
    domain: result.project.domain,
    os,
  });
}

export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain");
  const useDemo = new URL(request.url).searchParams.get("demo") === "1";
  return POST(
    new Request(request.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain: domain ?? undefined, useDemo: useDemo || !domain }),
    }),
  );
}
