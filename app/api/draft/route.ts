import { NextResponse } from "next/server";
import { z } from "zod";
import { getProjectStore } from "@/lib/projects/store";
import { buildActionBrief } from "@/lib/engines/action-brief";
import { draftFromBrief, GeminiNotConfiguredError } from "@/lib/providers/gemini-draft";
import { GeminiVisibilityProvider } from "@/lib/providers/gemini-visibility";
import { transitionApproval, type ApprovalState } from "@/lib/engines/brief-builder";

export const runtime = "nodejs";
export const maxDuration = 60;

const generateSchema = z.object({
  domain: z.string().min(1),
  actionId: z.string().min(1),
});

const approveSchema = z.object({
  draftId: z.string().min(1),
  briefId: z.string().min(1),
  body: z.string().min(1),
  claimFlags: z.array(z.object({ text: z.string(), reason: z.string() })),
  state: z.enum(["approved", "rejected", "in-review"]),
});

export async function POST(request: Request) {
  const json: unknown = await request.json().catch(() => null);
  const asApprove = approveSchema.safeParse(json);
  if (asApprove.success) {
    try {
      const draft = transitionApproval(
        {
          id: asApprove.data.draftId,
          briefId: asApprove.data.briefId,
          version: 1,
          body: asApprove.data.body,
          claimFlags: asApprove.data.claimFlags,
          approvalState: "draft",
          requiresApprovalToPublish: true,
        },
        asApprove.data.state as ApprovalState,
      );
      return NextResponse.json({ draft, publishReady: draft.approvalState === "approved" });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Cannot approve" }, { status: 400 });
    }
  }

  const parsed = generateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "domain and actionId required (or approval payload)" }, { status: 400 });
  }

  let provider: GeminiVisibilityProvider;
  try {
    provider = new GeminiVisibilityProvider();
  } catch (error) {
    if (error instanceof GeminiNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: "GEMINI_NOT_CONFIGURED" }, { status: 503 });
    }
    throw error;
  }

  const result = await getProjectStore().loadLatest(parsed.data.domain);
  if (!result) {
    return NextResponse.json({ error: "No live analyze found. Run Analyze first." }, { status: 404 });
  }
  const action = result.nextActions.find((a) => a.id === parsed.data.actionId);
  if (!action) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  }

  try {
    const pkg = buildActionBrief(result, action);
    const draft = await draftFromBrief(pkg, provider);
    return NextResponse.json({
      project: result.project,
      action,
      brief: pkg.brief,
      outline: pkg.outline,
      suggestedTitle: pkg.suggestedTitle,
      suggestedMetaDescription: pkg.suggestedMetaDescription,
      draft,
      provider: provider.model,
      publishReady: false,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Draft failed" }, { status: 502 });
  }
}
