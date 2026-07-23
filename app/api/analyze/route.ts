import { NextResponse } from "next/server";
import { z } from "zod";
import { publicWebsiteSchema } from "@/lib/security/url";
import { runSeoScan } from "@/lib/engines/run-seo-scan";
import { runGeoProbes } from "@/lib/engines/run-geo";
import { extractServicePhrases, guessBrandFromTitle } from "@/lib/engines/prompt-derive";
import { GeminiNotConfiguredError, GeminiVisibilityProvider } from "@/lib/providers/gemini-visibility";
import { buildNextActions } from "@/lib/engines/next-actions";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";
import { applyLearningFeedback } from "@/lib/engines/learning-feedback";
import { compareAnalyzeSnapshots, toSnapshot } from "@/lib/engines/analyze-delta";
import { runAllEpics } from "@/lib/epics/run-all-epics";
import { loadBusinessOverrides } from "@/lib/projects/business-profile";
import { domainKey, getProjectStore } from "@/lib/projects/store";
import type { AnalyzeResult } from "@/lib/analyze/types";
import type { EvidenceReference } from "@/lib/domain/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const schema = z.object({
  url: publicWebsiteSchema,
  force: z.boolean().optional(),
});

const GUARDRAILS = [
  "GEO results are directional samples from live model answers — not stable rankings.",
  "We do not ask “Who is {brand}?” — models invent company bios from names alone.",
  "Prompts are buyer-intent visibility checks; sample size and exact prompts are always shown.",
  "SEO scores come from crawled page evidence only.",
  "Search opportunities are crawl-derived estimates until Search Console is connected.",
];

function buildEvidence(projectId: string, domain: string, seoPages: number, geoSample: number): EvidenceReference[] {
  const now = new Date().toISOString();
  const evidence: EvidenceReference[] = [
    {
      id: "ev-live-crawl-page",
      organizationId: "local-demo",
      projectId,
      kind: "CRAWL_OBSERVATION",
      source: "SafeWebsiteCrawler",
      retrievedAt: now,
      observedAt: now,
      reliability: "HIGH",
      isEstimated: false,
      isSimulated: false,
      summary: `Live crawl of ${domain} covering ${seoPages} page(s).`,
    },
    {
      id: "ev-seo-aggregate",
      organizationId: "local-demo",
      projectId,
      kind: "CALCULATED",
      source: "site-audit",
      retrievedAt: now,
      observedAt: now,
      reliability: "HIGH",
      isEstimated: false,
      isSimulated: false,
      summary: "Site readiness aggregated from per-page live audit rules.",
    },
  ];
  if (geoSample > 0) {
    evidence.push({
      id: "ev-gemini-answers",
      organizationId: "local-demo",
      projectId,
      kind: "AI_ANSWER_OBSERVATION",
      source: "GeminiVisibilityProvider",
      retrievedAt: now,
      observedAt: now,
      reliability: "MEDIUM",
      isEstimated: false,
      isSimulated: false,
      summary: `${geoSample} live Gemini answer(s) for brand/service prompts.`,
    });
    evidence.push({
      id: "ev-gemini-citations",
      organizationId: "local-demo",
      projectId,
      kind: "CITATION_OBSERVATION",
      source: "geo-extract",
      retrievedAt: now,
      observedAt: now,
      reliability: "MEDIUM",
      isEstimated: true,
      isSimulated: false,
      summary: "URLs extracted from Gemini answers and classified first-party vs other.",
    });
  }
  return evidence;
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid URL" }, { status: 400 });
  }

  const store = getProjectStore();
  const domain = domainKey(parsed.data.url);

  if (!parsed.data.force) {
    const cached = await store.loadLatest(domain);
    if (cached) {
      const age = Date.now() - new Date(cached.analyzedAt).getTime();
      if (age >= 0 && age < 2 * 60 * 1000) {
        return NextResponse.json(cached);
      }
    }
  }

  let provider: GeminiVisibilityProvider;
  try {
    provider = new GeminiVisibilityProvider();
  } catch (error) {
    if (error instanceof GeminiNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 });
    }
    throw error;
  }

  try {
    const seo = await runSeoScan(parsed.data.url);
    const brandGuess = guessBrandFromTitle(seo.home.title, new URL(seo.finalUrl).hostname);
    const services = extractServicePhrases(
      [seo.home.title ?? "", seo.home.description ?? "", ...seo.pages.slice(0, 5).map((p) => p.title ?? "")].filter(Boolean),
      3,
    );

    const geo = await runGeoProbes({ brandGuess, domain, services, provider });
    const projectId = `proj-${domain}`;
    const evidence = buildEvidence(projectId, domain, seo.site.pagesScanned, geo.sampleSize);
    const pageIssues = seo.pages.filter((p) => p.ok).flatMap((p) => p.issues);
    const overrides = await loadBusinessOverrides(domain);
    const bundle = await store.loadBundle(domain);
    const history = bundle?.history ?? [];
    const priorPages = history[0]?.pages;

    const draft: AnalyzeResult = {
      project: { id: projectId, domain, brandGuess, url: parsed.data.url },
      seo: {
        site: seo.site,
        pages: seo.pages,
        siteIssues: seo.siteIssues,
        scannedAt: seo.scannedAt,
        finalUrl: seo.finalUrl,
        origin: seo.origin,
        robotsTxt: seo.robotsTxt,
        sitemapFound: seo.sitemapFound,
      },
      geo,
      evidence,
      nextActions: [],
      guardrails: GUARDRAILS,
      analyzedAt: new Date().toISOString(),
    };

    const intelDraft = buildLiveIntelligence(draft, {
      overrides: overrides ?? undefined,
      nextActions: [],
      history,
      priorPages,
    });
    let nextActions = buildNextActions({
      projectId,
      domain,
      brandGuess,
      site: seo.site,
      siteIssues: seo.siteIssues,
      pageIssues,
      geo,
      evidence,
      coverageGaps: intelDraft.siteInventory.coverageGaps,
      aiAccess: intelDraft.aiAccess,
      searchOpportunities: intelDraft.searchOpportunities,
      competitorGaps: intelDraft.competitorGaps,
      contentRefreshUrls: intelDraft.contentRefreshIds,
      goals: intelDraft.goals,
      citationGaps: intelDraft.citationGaps,
    });

    if (history[0]) {
      const preview = compareAnalyzeSnapshots(history[0], toSnapshot({ ...draft, nextActions }));
      nextActions = applyLearningFeedback(nextActions, preview);
    }

    const intelligence = buildLiveIntelligence(draft, {
      overrides: overrides ?? undefined,
      nextActions,
      history,
      priorPages,
    });
    const result: AnalyzeResult = { ...draft, nextActions, intelligence };

    await store.save(result);
    result.delta = await store.loadDelta(domain);

    const suite = runAllEpics({
      result,
      overrides: overrides ?? undefined,
      history,
      delta: result.delta,
      intelligence,
    });
    result.epicSuite = {
      completedCount: suite.completedCount,
      totalCount: suite.totalCount,
      complete: true,
      summaries: suite.epics.map((e) => ({ epicId: e.epicId, summary: e.summary })),
    };
    // Persist suite summaries (full data available via /api/epics).
    await store.save(result);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analyze failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "domain query required" }, { status: 400 });
  }
  const store = getProjectStore();
  if (url.searchParams.get("delta") === "1") {
    const delta = await store.loadDelta(domain);
    if (!delta) return NextResponse.json({ error: "No prior run to compare" }, { status: 404 });
    return NextResponse.json({ delta });
  }
  const result = await store.loadLatest(domain);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  result.delta = await store.loadDelta(domain);
  return NextResponse.json(result);
}
