import { NextResponse } from "next/server";
import { z } from "zod";
import { getProjectStore } from "@/lib/projects/store";
import { buildActionBrief } from "@/lib/engines/action-brief";
import { draftFromBrief, GeminiNotConfiguredError } from "@/lib/providers/gemini-draft";
import { GeminiVisibilityProvider } from "@/lib/providers/gemini-visibility";
import { transitionApproval, type ApprovalState } from "@/lib/engines/brief-builder";
import { validateClaims, canApprove } from "@/lib/engines/claim-validation";
import { getAssetVersionStore } from "@/lib/engines/asset-versions";

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
  humanAckCleared: z.boolean().optional(),
  domain: z.string().optional(),
  actionId: z.string().optional(),
});

export async function POST(request: Request) {
  const json: unknown = await request.json().catch(() => null);
  const asApprove = approveSchema.safeParse(json);
  if (asApprove.success) {
    try {
      const validated = validateClaims(asApprove.data.body);
      const flags =
        asApprove.data.humanAckCleared || asApprove.data.claimFlags.length === 0
          ? asApprove.data.claimFlags
          : validated.map((f) => ({ text: f.text, reason: f.reason }));

      if (asApprove.data.state === "approved" && !canApprove(validated, Boolean(asApprove.data.humanAckCleared || asApprove.data.claimFlags.length === 0))) {
        return NextResponse.json(
          {
            error: "Blocking claim flags remain. Clear claims after human review (set claimFlags: [] or humanAckCleared).",
            claimFlags: validated,
          },
          { status: 400 },
        );
      }

      const draft = transitionApproval(
        {
          id: asApprove.data.draftId,
          briefId: asApprove.data.briefId,
          version: 1,
          body: asApprove.data.body,
          claimFlags: flags,
          approvalState: "draft",
          requiresApprovalToPublish: true,
        },
        asApprove.data.state as ApprovalState,
      );

      if (asApprove.data.domain && asApprove.data.actionId) {
        await getAssetVersionStore().append({
          id: `${draft.id}-${Date.now()}`,
          domain: asApprove.data.domain,
          actionId: asApprove.data.actionId,
          kind: "draft",
          body: draft.body,
          approvalState: draft.approvalState === "approved" ? "approved" : draft.approvalState === "rejected" ? "rejected" : "reviewed",
          claimFlags: draft.claimFlags,
          createdAt: new Date().toISOString(),
          parentId: draft.id,
        });
      }

      return NextResponse.json({ draft, publishReady: draft.approvalState === "approved", claimValidation: validated });
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
    const extraFlags = validateClaims(draft.body);
    const mergedFlags = [
      ...draft.claimFlags,
      ...extraFlags
        .filter((f) => !draft.claimFlags.some((d) => d.text === f.text))
        .map((f) => ({ text: f.text, reason: f.reason })),
    ];
    const withFlags = { ...draft, claimFlags: mergedFlags };

    await getAssetVersionStore().append({
      id: `${withFlags.id}-v1`,
      domain: result.project.domain,
      actionId: action.id,
      kind: "draft",
      body: withFlags.body,
      approvalState: "draft",
      claimFlags: withFlags.claimFlags,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      project: result.project,
      action,
      brief: pkg.brief,
      outline: pkg.outline,
      suggestedTitle: pkg.suggestedTitle,
      suggestedMetaDescription: pkg.suggestedMetaDescription,
      draft: withFlags,
      provider: provider.model,
      publishReady: false,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Draft failed" }, { status: 502 });
  }
}
