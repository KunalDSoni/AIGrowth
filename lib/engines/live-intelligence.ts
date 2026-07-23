/**
 * Live Project Intelligence — wires every epic cluster to one AnalyzeResult.
 * All outputs are derived from crawl + GEO evidence (plus optional user profile).
 * No Northstar/demo datasets.
 */

import type {
  AIVisibilityObservation,
  BusinessProfileSnapshot,
  WebsitePageProfile,
} from "@/lib/domain/types";
import type { AnalyzeResult, GeoResult } from "@/lib/analyze/types";
import { auditAiAccess, type AccessFinding } from "@/lib/engines/ai-access";
import {
  applyConfirmation,
  buildBusinessGraph,
  pendingReview,
  type BusinessGraph,
  type ConfirmationEvent,
} from "@/lib/engines/business-graph";
import { buildCampaign, type Campaign } from "@/lib/engines/campaign";
import { extractCitations, type CitationIntelligence } from "@/lib/engines/citation-intelligence";
import {
  buildContentInventory,
  detectRefreshCandidates,
  type ContentInventoryItem,
} from "@/lib/engines/content-inventory";
import {
  detectCompetitorGaps,
  normalizeCompetitor,
  type CompetitorGap,
  type CompetitorRecord,
} from "@/lib/engines/competitor-intelligence";
import { buildDemandProxy, type PromptOpportunity } from "@/lib/engines/demand-proxy";
import { classifyIntent, clusterTopics, type IntentClassification, type TopicCluster } from "@/lib/engines/search-intent";
import { buildSiteInventory, type SiteInventory } from "@/lib/engines/site-inventory";
import { generatePromptVariants, type PromptVariant } from "@/lib/engines/prompt-variants";
import { extractServicePhrases } from "@/lib/engines/prompt-derive";
import type { DemandSignal } from "@/lib/providers/search";
import type { RankedCandidate } from "@/lib/engines/recommendation-bus";

export type GoalFocus =
  | "leads"
  | "authority"
  | "local"
  | "ai-visibility"
  | "technical-health";

export interface ProjectGoals {
  primary: GoalFocus;
  weights: Partial<Record<GoalFocus, number>>;
}

export interface LiveIntelligence {
  profile: BusinessProfileSnapshot;
  goals: ProjectGoals;
  graph: BusinessGraph;
  pendingReview: ReturnType<typeof pendingReview>;
  siteInventory: SiteInventory;
  contentInventory: ContentInventoryItem[];
  contentRefreshIds: string[];
  searchOpportunities: PromptOpportunity[];
  intentByQuery: IntentClassification[];
  topicClusters: TopicCluster[];
  citations: CitationIntelligence;
  competitors: CompetitorRecord[];
  competitorGaps: CompetitorGap[];
  aiAccess: AccessFinding[];
  promptVariants: PromptVariant[];
  campaign: Campaign | null;
  labels: string[];
}

export interface BusinessProfileOverrides {
  name?: string;
  market?: string;
  industry?: string;
  goal?: string;
  audienceSegments?: string[];
  services?: string[];
  differentiators?: string[];
  tone?: string;
  goals?: ProjectGoals;
  confirmations?: ConfirmationEvent[];
}

const DEFAULT_GOALS: ProjectGoals = {
  primary: "leads",
  weights: {
    leads: 80,
    authority: 50,
    local: 40,
    "ai-visibility": 70,
    "technical-health": 60,
  },
};

function geoToAiObservations(geo: GeoResult, brand: string): AIVisibilityObservation[] {
  return geo.observations.map((obs) => ({
    id: obs.id,
    familyId: `family-${obs.id}`,
    exactPrompt: obs.prompt,
    platform: "Gemini",
    model: geo.model,
    locale: "en",
    runId: geo.runId,
    observedAt: new Date().toISOString(),
    rawResponse: obs.rawResponse,
    brandMentions: obs.brandMentioned ? [brand] : [],
    competitorMentions: [],
    citations: obs.citations.map((c) => ({
      url: c.url,
      domain: c.domain,
      title: c.domain,
    })),
    sentiment: "neutral",
    extractionConfidence: obs.error ? 20 : 70,
    isSimulated: false,
  }));
}

function pagesToWebsiteProfiles(result: AnalyzeResult, services: string[]): WebsitePageProfile[] {
  return result.seo.pages
    .filter((p) => p.ok)
    .map((p, index) => {
      const path = (() => {
        try {
          return new URL(p.finalUrl).pathname;
        } catch {
          return "/";
        }
      })();
      return {
        id: `page-${index}`,
        url: p.finalUrl,
        title: p.title ?? p.finalUrl,
        pageType: path === "/" ? "home" : "service",
        services,
        audiences: [],
        funnelStage: "consideration",
      };
    });
}

export function inferBusinessProfile(
  result: AnalyzeResult,
  overrides?: BusinessProfileOverrides,
): BusinessProfileSnapshot {
  const titles = result.seo.pages.filter((p) => p.ok).map((p) => p.title ?? "").filter(Boolean);
  const inferredServices =
    overrides?.services ??
    extractServicePhrases([result.seo.pages[0]?.title ?? "", ...titles].filter(Boolean), 5);

  return {
    id: `biz-${result.project.domain}`,
    name: overrides?.name ?? result.project.brandGuess,
    market: overrides?.market ?? "Unknown market (confirm)",
    industry: overrides?.industry ?? "Unknown industry (confirm)",
    goal: overrides?.goal ?? "Generate qualified leads from organic + AI discovery",
    audienceSegments: overrides?.audienceSegments ?? ["Buyers researching this category"],
    services: inferredServices.length ? inferredServices : ["Core service (confirm)"],
    differentiators: overrides?.differentiators ?? [],
    tone: overrides?.tone ?? "Clear, factual, professional",
  };
}

function crawlDemandSignals(profile: BusinessProfileSnapshot, geo: GeoResult): DemandSignal[] {
  const queries = [
    ...profile.services.map((s) => `best ${s} providers`),
    ...geo.observations.slice(0, 6).map((o) => o.prompt),
  ];
  return [...new Set(queries)].map((query) => {
    const service =
      profile.services.find((s) => query.toLowerCase().includes(s.toLowerCase().split(/\s+/)[0])) ??
      profile.services[0] ??
      "service";
    return {
      query,
      topic: service,
      service,
      source: "crawl-derived" as const,
      isEstimated: true,
      competitionIndex: 55,
    };
  });
}

export function buildLiveIntelligence(
  result: AnalyzeResult,
  overrides?: BusinessProfileOverrides,
  nextActionsOverride?: RankedCandidate[],
): LiveIntelligence {
  const profile = inferBusinessProfile(result, overrides);
  const goals = overrides?.goals ?? DEFAULT_GOALS;
  const actions = nextActionsOverride ?? result.nextActions ?? [];
  const observations = result.seo.pages
    .filter((p) => p.ok && p.observation)
    .map((p) => p.observation!);

  const competitorDomains = [
    ...new Set(
      result.geo.observations.flatMap((o) =>
        o.citations.filter((c) => c.classification === "other").map((c) => c.domain),
      ),
    ),
  ].slice(0, 12);

  const competitors = competitorDomains.map((domain) =>
    normalizeCompetitor({
      name: domain,
      type: "citation",
      source: "live-geo-citation",
      confidence: 55,
    }),
  );

  let graph = buildBusinessGraph({
    business: profile,
    pages: pagesToWebsiteProfiles(result, profile.services),
    competitors: competitorDomains,
    profileEvidenceId: result.evidence[0]?.id,
  });

  for (const event of overrides?.confirmations ?? []) {
    graph = applyConfirmation(graph, event).graph;
  }

  const siteInventory = buildSiteInventory({
    pages: observations.length
      ? observations
      : result.seo.pages
          .filter((p) => p.ok)
          .map((p, i) => ({
            id: `fallback-${i}`,
            url: (() => {
              try {
                return new URL(p.finalUrl).pathname;
              } catch {
                return "/";
              }
            })(),
            statusCode: 200,
            title: p.title ?? undefined,
            h1Count: 1,
            wordCount: 400,
            hasViewport: true,
            hasStructuredData: false,
            imageCount: 0,
            imagesMissingAlt: 0,
            internalLinkCount: 3,
            pageType: "service" as const,
          })),
    business: profile,
  });

  const contentInventory = buildContentInventory(
    siteInventory.pages.map((classified) => {
      const obs =
        observations.find((o) => o.url === classified.url) ??
        observations[0] ?? {
          id: "empty",
          url: classified.url,
          statusCode: 200,
          h1Count: 1,
          wordCount: 200,
          hasViewport: true,
          hasStructuredData: false,
          imageCount: 0,
          imagesMissingAlt: 0,
          internalLinkCount: 1,
          pageType: "service" as const,
        };
      return {
        observation: obs,
        targetQuery: profile.services[0] ?? classified.purpose,
        purpose: classified.purpose,
        lastUpdated: result.analyzedAt,
        hasProof: false,
        hasClearCta: false,
        metrics: {
          impressions: 0,
          clicks: 0,
          position: 0,
          source: "simulated" as const,
        },
      };
    }),
  );
  // Mark performance as unavailable — we do not invent GSC numbers.
  for (const item of contentInventory) {
    item.impressions = 0;
    item.clicks = 0;
    item.position = 0;
    item.seoValue = Math.min(100, Math.round(item.wordCount / 10));
    item.performanceSource = "simulated";
  }

  const contentRefreshIds = detectRefreshCandidates(contentInventory).map((c) => c.url);

  const demandSignals = crawlDemandSignals(profile, result.geo);
  const searchOpportunities = buildDemandProxy({ signals: demandSignals, business: profile });
  const intentByQuery = searchOpportunities.map((o) => classifyIntent(o.query));
  const topicClusters = clusterTopics(searchOpportunities.map((o) => o.query));

  const aiObs = geoToAiObservations(result.geo, result.project.brandGuess);
  const citations = extractCitations({
    observations: aiObs,
    firstPartyDomain: result.project.domain,
    competitors: competitorDomains,
  });

  const competitorGaps = detectCompetitorGaps({
    observations: aiObs,
    competitors: competitorDomains,
    firstPartyDomain: result.project.domain,
  });

  const pageRobots: Record<string, string> = {};
  for (const page of result.seo.pages) {
    if (page.ok && page.robotsDirectives) pageRobots[page.finalUrl] = page.robotsDirectives;
  }

  const aiAccess = auditAiAccess({
    robotsTxt: result.seo.robotsTxt ?? null,
    sitemapFound: result.seo.sitemapFound ?? false,
    pageRobotsDirectives: pageRobots,
  });

  const basePrompt =
    result.geo.observations[0]?.prompt ??
    `best ${profile.services[0] ?? "provider"} for ${profile.market}`;
  const promptVariants = generatePromptVariants({
    familyId: "live-primary",
    baseQuestion: basePrompt,
    axes: {
      geographies: profile.market.includes("Unknown") ? [] : [profile.market],
      personas: profile.audienceSegments.slice(0, 2),
      buyingStages: ["awareness", "consideration", "decision"],
    },
  }).slice(0, 12);

  const campaign =
    actions.length > 0
      ? buildCampaign({
          name: `${result.project.brandGuess} growth sprint`,
          objective: profile.goal,
          recommendations: actions.slice(0, 5).map((a) => ({
            id: a.id,
            title: a.title,
            assetType: a.source === "technical" ? "fix" : "content",
          })),
        })
      : null;

  return {
    profile,
    goals,
    graph,
    pendingReview: pendingReview(graph),
    siteInventory,
    contentInventory,
    contentRefreshIds,
    searchOpportunities,
    intentByQuery,
    topicClusters,
    citations,
    competitors,
    competitorGaps,
    aiAccess,
    promptVariants,
    campaign,
    labels: [
      "Intelligence derived from live crawl + Gemini GEO only",
      "Search demand is crawl-derived estimates — not Search Console",
      "Content performance metrics are unavailable until GSC is connected",
      "Competitor list is citation-based, not a full market crawl",
    ],
  };
}

/** Re-rank next actions using business goal weights (BIZ-010 / REC-010). */
export function applyGoalWeights(
  actions: RankedCandidate[],
  goals: ProjectGoals,
): RankedCandidate[] {
  const w = { ...DEFAULT_GOALS.weights, ...goals.weights };
  const boost = (source: RankedCandidate["source"]): number => {
    switch (source) {
      case "technical":
        return (w["technical-health"] ?? 50) / 50;
      case "ai-visibility":
      case "citation":
        return (w["ai-visibility"] ?? 50) / 50;
      case "search":
      case "content":
        return (w.leads ?? 50) / 50;
      case "competitor":
        return (w.authority ?? 50) / 50;
      default:
        return 1;
    }
  };

  const primaryBoost = (a: RankedCandidate): number => {
    if (goals.primary === "ai-visibility" && (a.source === "ai-visibility" || a.source === "citation")) return 1.25;
    if (goals.primary === "technical-health" && a.source === "technical") return 1.25;
    if (goals.primary === "leads" && (a.source === "search" || a.source === "content" || a.source === "citation"))
      return 1.2;
    if (goals.primary === "local" && /local|location|near/i.test(a.title + a.action)) return 1.2;
    if (goals.primary === "authority" && (a.source === "competitor" || a.source === "citation")) return 1.2;
    return 1;
  };

  return [...actions]
    .map((a) => {
      const priorityScore = Math.min(100, Math.round(a.priorityScore * boost(a.source) * primaryBoost(a)));
      return { ...a, priorityScore };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((a, index) => ({ ...a, rank: index + 1 }));
}
