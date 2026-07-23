import { NextResponse } from "next/server";
import { z } from "zod";
import { buildActionBrief } from "@/lib/engines/action-brief";
import { buildMetadataPack, buildRepurposePack } from "@/lib/engines/metadata-pack";
import type { AnalyzeResult } from "@/lib/analyze/types";

export const runtime = "nodejs";

const schema = z.object({
  result: z.custom<AnalyzeResult>(),
  actionId: z.string().min(1),
  assetType: z.enum(["metadata", "service", "article", "faq", "social", "email"]).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const action = parsed.data.result.nextActions.find((a) => a.id === parsed.data.actionId);
  if (!action) return NextResponse.json({ error: "Action not found" }, { status: 404 });

  const pkg = buildActionBrief(parsed.data.result, action);
  const metadata = buildMetadataPack(pkg, parsed.data.assetType ?? "metadata");
  const repurpose = buildRepurposePack(pkg);
  return NextResponse.json({ brief: pkg, metadata, repurpose });
}
