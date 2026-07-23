import { NextResponse } from "next/server";
import { z } from "zod";
import {
  appendConfirmation,
  loadBusinessOverrides,
  saveBusinessOverrides,
  saveGoals,
} from "@/lib/projects/business-profile";
import { domainKey, getProjectStore } from "@/lib/projects/store";
import { buildLiveIntelligence, type GoalFocus } from "@/lib/engines/live-intelligence";
import { buildNextActions } from "@/lib/engines/next-actions";

export const runtime = "nodejs";

const goalsSchema = z.object({
  primary: z.enum(["leads", "authority", "local", "ai-visibility", "technical-health"]),
  weights: z
    .object({
      leads: z.number().min(0).max(100).optional(),
      authority: z.number().min(0).max(100).optional(),
      local: z.number().min(0).max(100).optional(),
      "ai-visibility": z.number().min(0).max(100).optional(),
      "technical-health": z.number().min(0).max(100).optional(),
    })
    .optional(),
});

const bodySchema = z.object({
  domain: z.string().min(1),
  profile: z
    .object({
      name: z.string().optional(),
      market: z.string().optional(),
      industry: z.string().optional(),
      goal: z.string().optional(),
      audienceSegments: z.array(z.string()).optional(),
      services: z.array(z.string()).optional(),
      differentiators: z.array(z.string()).optional(),
      tone: z.string().optional(),
    })
    .optional(),
  goals: goalsSchema.optional(),
  confirmation: z
    .object({
      entityId: z.string(),
      action: z.enum(["confirm", "reject", "edit"]),
      label: z.string().optional(),
      note: z.string().optional(),
    })
    .optional(),
  competitorCorrection: z
    .object({
      name: z.string().min(1),
      type: z.enum(["business", "organic", "local", "ai-answer", "citation"]),
      relevant: z.boolean().optional(),
    })
    .optional(),
  rerank: z.boolean().optional(),
});

export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain");
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
  const overrides = await loadBusinessOverrides(domainKey(domain));
  const latest = await getProjectStore().loadLatest(domainKey(domain));
  if (!latest) return NextResponse.json({ overrides, intelligence: null });
  const intelligence = buildLiveIntelligence(latest, overrides ?? undefined, latest.nextActions);
  return NextResponse.json({ overrides, intelligence });
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const domain = domainKey(parsed.data.domain);
  let overrides = (await loadBusinessOverrides(domain)) ?? {};

  if (parsed.data.profile) {
    overrides = (await saveBusinessOverrides(domain, { ...overrides, ...parsed.data.profile })).overrides;
  }
  if (parsed.data.goals) {
    overrides = await saveGoals(domain, {
      primary: parsed.data.goals.primary as GoalFocus,
      weights: parsed.data.goals.weights ?? {},
    });
  }
  if (parsed.data.confirmation) {
    overrides = await appendConfirmation(domain, {
      ...parsed.data.confirmation,
      at: new Date().toISOString(),
    });
  }
  if (parsed.data.competitorCorrection) {
    const existing = overrides.competitorCorrections ?? [];
    const next = [
      ...existing.filter((c) => c.name.toLowerCase() !== parsed.data.competitorCorrection!.name.toLowerCase()),
      parsed.data.competitorCorrection,
    ];
    overrides = (await saveBusinessOverrides(domain, { ...overrides, competitorCorrections: next })).overrides;
  }

  const store = getProjectStore();
  const latest = await store.loadLatest(domain);
  if (!latest) {
    return NextResponse.json({ overrides, intelligence: null, nextActions: null });
  }

  const intelDraft = buildLiveIntelligence(latest, overrides, []);
  let nextActions = latest.nextActions;
  if (parsed.data.rerank || parsed.data.goals) {
    const pageIssues = latest.seo.pages.filter((p) => p.ok).flatMap((p) => p.issues);
    nextActions = buildNextActions({
      projectId: latest.project.id,
      domain: latest.project.domain,
      brandGuess: latest.project.brandGuess,
      site: latest.seo.site,
      siteIssues: latest.seo.siteIssues,
      pageIssues,
      geo: latest.geo,
      evidence: latest.evidence,
      coverageGaps: intelDraft.siteInventory.coverageGaps,
      aiAccess: intelDraft.aiAccess,
      searchOpportunities: intelDraft.searchOpportunities,
      competitorGaps: intelDraft.competitorGaps,
      contentRefreshUrls: intelDraft.contentRefreshIds,
      goals: intelDraft.goals,
    });
    const updated = {
      ...latest,
      nextActions,
      intelligence: buildLiveIntelligence(latest, overrides, nextActions),
      analyzedAt: latest.analyzedAt,
    };
    await store.save(updated);
    return NextResponse.json({ overrides, intelligence: updated.intelligence, nextActions });
  }

  const intelligence = buildLiveIntelligence(latest, overrides, nextActions);
  return NextResponse.json({ overrides, intelligence, nextActions });
}
