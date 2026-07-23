import { NextResponse } from "next/server";
import { z } from "zod";
import { getProjectStore } from "@/lib/projects/store";
import { buildActionBrief } from "@/lib/engines/action-brief";

export const runtime = "nodejs";

const schema = z.object({
  domain: z.string().min(1),
  actionId: z.string().min(1),
});

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "domain and actionId required" }, { status: 400 });
  }

  const result = await getProjectStore().loadLatest(parsed.data.domain);
  if (!result) {
    return NextResponse.json({ error: "No live analyze found for domain. Run Analyze first." }, { status: 404 });
  }

  const action = result.nextActions.find((a) => a.id === parsed.data.actionId);
  if (!action) {
    return NextResponse.json({ error: "Action not found in latest analyze" }, { status: 404 });
  }

  const pkg = buildActionBrief(result, action);
  return NextResponse.json({
    project: result.project,
    action,
    ...pkg,
  });
}
