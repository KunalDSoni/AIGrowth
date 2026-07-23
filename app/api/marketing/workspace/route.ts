import { NextResponse } from "next/server";
import { z } from "zod";
import {
  approvePlan,
  generateWorkspace,
  loadWorkspace,
  NoProjectDataError,
  updateOutreachStatus,
  updatePackStatus,
} from "@/lib/marketing/workspace";

export const runtime = "nodejs";
export const maxDuration = 60;

const generateSchema = z.object({
  domain: z.string().min(1, "A domain is required — this product does not generate sample data"),
  hoursPerWeek: z.number().min(1).max(40).optional(),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("pack_status"),
    domain: z.string(),
    packId: z.string(),
    status: z.enum(["draft", "review", "approved", "shipped"]),
  }),
  z.object({
    action: z.literal("outreach_status"),
    domain: z.string(),
    targetId: z.string(),
    status: z.enum(["todo", "pitched", "follow-up", "won", "lost"]),
  }),
  z.object({
    action: z.literal("approve_plan"),
    domain: z.string(),
  }),
]);

/** GET ?domain= — load persisted workspace (does NOT regenerate). */
export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain");
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
  const ws = await loadWorkspace(domain);
  if (!ws) return NextResponse.json({ error: "No workspace. Click Generate first.", code: "NOT_GENERATED" }, { status: 404 });
  return NextResponse.json({ workspace: ws });
}

/** POST generate or mutate. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Mutation actions
  if ("action" in body) {
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid action" }, { status: 400 });
    }
    try {
      if (parsed.data.action === "pack_status") {
        const ws = await updatePackStatus(parsed.data.domain, parsed.data.packId, parsed.data.status);
        return NextResponse.json({ workspace: ws });
      }
      if (parsed.data.action === "outreach_status") {
        const ws = await updateOutreachStatus(parsed.data.domain, parsed.data.targetId, parsed.data.status);
        return NextResponse.json({ workspace: ws });
      }
      const ws = await approvePlan(parsed.data.domain);
      return NextResponse.json({ workspace: ws });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Action failed" }, { status: 400 });
    }
  }

  // Generate workspace
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  try {
    const workspace = await generateWorkspace({
      domain: parsed.data.domain,
      hoursPerWeek: parsed.data.hoursPerWeek ?? 8,
    });
    return NextResponse.json({ workspace, generated: true });
  } catch (error) {
    if (error instanceof NoProjectDataError) {
      return NextResponse.json({ error: error.message, needsScan: true }, { status: 409 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Generate failed" }, { status: 500 });
  }
}
