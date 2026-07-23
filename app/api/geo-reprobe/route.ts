import { NextResponse } from "next/server";
import { z } from "zod";
import { GeminiNotConfiguredError, GeminiVisibilityProvider } from "@/lib/providers/gemini-visibility";
import { runGeoProbes } from "@/lib/engines/run-geo";
import { extractServicePhrases } from "@/lib/engines/prompt-derive";
import { domainKey, getProjectStore } from "@/lib/projects/store";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";
import { loadBusinessOverrides } from "@/lib/projects/business-profile";
import { buildNextActions } from "@/lib/engines/next-actions";
import type { EvidenceReference } from "@/lib/domain/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const schema = z.object({
  domain: z.string().min(1),
  useVariants: z.boolean().optional(),
  maxPrompts: z.number().min(1).max(12).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const domain = domainKey(parsed.data.domain);
  const store = getProjectStore();
  const latest = await store.loadLatest(domain);
  if (!latest) return NextResponse.json({ error: "Analyze the site first" }, { status: 404 });

  let provider: GeminiVisibilityProvider;
  try {
    provider = new GeminiVisibilityProvider();
  } catch (error) {
    if (error instanceof GeminiNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 });
    }
    throw error;
  }

  const services = extractServicePhrases(
    latest.seo.pages.filter((p) => p.ok).map((p) => p.title ?? "").filter(Boolean),
    3,
  );

  const overrides = await loadBusinessOverrides(domain);
  const intel = buildLiveIntelligence(latest, overrides ?? undefined, latest.nextActions);
  const variantPrompts = parsed.data.useVariants
    ? intel.promptVariants.slice(0, parsed.data.maxPrompts ?? 6).map((v) => v.text)
    : undefined;

  const geo = await runGeoProbes({
    brandGuess: latest.project.brandGuess,
    domain,
    services,
    provider,
    maxPrompts: parsed.data.maxPrompts ?? 6,
    prompts: variantPrompts,
    runId: `geo-reprobe-${Date.now()}`,
  });

  const now = new Date().toISOString();
  const evidence: EvidenceReference[] = [
    ...latest.evidence.filter((e) => e.kind !== "AI_ANSWER_OBSERVATION" && e.kind !== "CITATION_OBSERVATION"),
    {
      id: "ev-gemini-answers",
      organizationId: "local-demo",
      projectId: latest.project.id,
      kind: "AI_ANSWER_OBSERVATION",
      source: "GeminiVisibilityProvider",
      retrievedAt: now,
      observedAt: now,
      reliability: "MEDIUM",
      isEstimated: false,
      isSimulated: false,
      summary: `${geo.sampleSize} GEO re-probe answer(s)${variantPrompts ? " with prompt variants" : ""}.`,
    },
    {
      id: "ev-gemini-citations",
      organizationId: "local-demo",
      projectId: latest.project.id,
      kind: "CITATION_OBSERVATION",
      source: "geo-extract",
      retrievedAt: now,
      observedAt: now,
      reliability: "MEDIUM",
      isEstimated: true,
      isSimulated: false,
      summary: "Citations from GEO re-probe.",
    },
  ];

  const draft = { ...latest, geo, evidence, analyzedAt: now };
  const intelDraft = buildLiveIntelligence(draft, overrides ?? undefined, []);
  const pageIssues = draft.seo.pages.filter((p) => p.ok).flatMap((p) => p.issues);
  const nextActions = buildNextActions({
    projectId: latest.project.id,
    domain,
    brandGuess: latest.project.brandGuess,
    site: draft.seo.site,
    siteIssues: draft.seo.siteIssues,
    pageIssues,
    geo,
    evidence,
    coverageGaps: intelDraft.siteInventory.coverageGaps,
    aiAccess: intelDraft.aiAccess,
    searchOpportunities: intelDraft.searchOpportunities,
    competitorGaps: intelDraft.competitorGaps,
    contentRefreshUrls: intelDraft.contentRefreshIds,
    goals: intelDraft.goals,
  });
  const intelligence = buildLiveIntelligence(draft, overrides ?? undefined, nextActions);
  const result = { ...draft, nextActions, intelligence };
  await store.save(result);
  result.delta = await store.loadDelta(domain);
  return NextResponse.json(result);
}
