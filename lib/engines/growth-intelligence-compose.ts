/**
 * Growth Intelligence composition — packages the existing intelligence engines
 * into one unified, live-evidence-driven report.
 *
 * This module is the adapter between `buildLiveIntelligence` (live crawl + GEO
 * evidence) and the pure aggregator in `growth-intelligence.ts`. It does not
 * invent data and it carries honesty labels + evidence IDs through untouched.
 */

import type { AnalyzeResult } from "@/lib/analyze/types";
import type {
  AIVisibilityObservation,
  AIVisibilityPromptFamily,
  AIVisibilitySummary,
  AuditIssue,
  CitationGapAction,
  ContentOpportunity,
  GrowthIntelligenceReport,
  GrowthPillarId,
  OutcomeLearningRecord,
  PillarSummary,
} from "@/lib/domain/types";
import {
  buildGrowthSignals,
  buildUnifiedGrowthDecisions,
  seoGuardrails,
  type RecommendationSignalInput,
} from "@/lib/engines/growth-intelligence";
import type { SourceEngine } from "@/lib/engines/recommendation-bus";
import { summarizeAIVisibility } from "@/lib/engines/ai-visibility";

/** The six product-facing pillars, in fixed display order. */
export const GROWTH_PILLARS: { id: GrowthPillarId; label: string }[] = [
  { id: "search", label: "Search Intelligence" },
  { id: "technical", label: "Technical Intelligence" },
  { id: "business", label: "Business Intelligence" },
  { id: "content", label: "Content Intelligence" },
  { id: "ai-visibility", label: "AI Visibility Intelligence" },
  { id: "marketing", label: "Marketing Intelligence" },
];

/** A zeroed summary per pillar, in fixed order — the empty-evidence baseline. */
export function emptyPillarSummaries(): PillarSummary[] {
  return GROWTH_PILLARS.map((pillar) => ({
    id: pillar.id,
    label: pillar.label,
    signalCount: 0,
    topSignalTitle: null,
    evidenceIds: [],
    labels: [],
  }));
}

/** The six typed arrays the pure aggregator (`buildGrowthSignals`) consumes. */
export interface AggregatorInputs {
  recommendations: RecommendationSignalInput[];
  auditIssues: AuditIssue[];
  opportunities: ContentOpportunity[];
  aiVisibility: AIVisibilitySummary[];
  citationGaps: CitationGapAction[];
  outcomes: OutcomeLearningRecord[];
}

/** Single live prompt family — GEO probes are one Gemini run, not seeded families. */
const LIVE_FAMILY_ID = "live-primary";

function toAiObservations(result: AnalyzeResult): AIVisibilityObservation[] {
  return result.geo.observations.map((obs) => ({
    id: obs.id,
    familyId: LIVE_FAMILY_ID,
    exactPrompt: obs.prompt,
    platform: "Gemini",
    model: result.geo.model,
    locale: "en",
    runId: result.geo.runId,
    observedAt: result.analyzedAt,
    rawResponse: obs.rawResponse,
    brandMentions: obs.brandMentioned ? [result.project.brandGuess] : [],
    competitorMentions: [],
    citations: obs.citations.map((c) => ({ url: c.url, domain: c.domain, title: c.domain })),
    sentiment: "neutral",
    extractionConfidence: obs.error ? 20 : 70,
    isSimulated: false,
  }));
}

function toAiVisibility(result: AnalyzeResult): AIVisibilitySummary[] {
  const observations = toAiObservations(result);
  if (observations.length === 0) return [];
  const family: AIVisibilityPromptFamily = {
    id: LIVE_FAMILY_ID,
    topic: result.project.brandGuess,
    buyingStage: "consideration",
    persona: "Buyers researching this category",
    geography: "unspecified",
    prompts: observations.map((o) => o.exactPrompt),
  };
  return summarizeAIVisibility([family], observations, result.project.brandGuess);
}

/**
 * Map one live `AnalyzeResult` into the aggregator's six typed inputs.
 *
 * v1 sources: audit issues, next actions, citation gaps and AI-visibility come
 * from live crawl + GEO evidence. Content opportunities and outcomes have no
 * source on the analyze result yet, so they are empty here and labelled as
 * pending in the assembled report — never fabricated.
 */
export function toAggregatorInputs(result: AnalyzeResult): AggregatorInputs {
  return {
    recommendations: result.nextActions.map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      evidenceIds: candidate.evidenceIds,
      scoreComponents: candidate.scoreComponents,
    })),
    auditIssues: result.seo.siteIssues,
    opportunities: [],
    aiVisibility: toAiVisibility(result),
    citationGaps: result.intelligence?.citationGaps ?? [],
    outcomes: [],
  };
}

/** Where a ranked next-action lands among the six pillars, by its origin engine. */
function pillarForActionSource(source: SourceEngine): GrowthPillarId {
  switch (source) {
    case "search":
      return "search";
    case "content":
      return "content";
    case "technical":
      return "technical";
    case "ai-visibility":
    case "citation":
      return "ai-visibility";
    case "competitor":
      return "business";
    case "outcome":
      return "marketing";
  }
}

/** Why a given pillar has no ranked signals in this run — stated, never hidden. */
const EMPTY_PILLAR_REASON: Record<GrowthPillarId, string> = {
  search: "No search-intent actions in this run.",
  technical: "No technical issues detected in this run.",
  business: "Business intelligence is qualitative context; no ranked signals yet.",
  content: "Content-opportunity signals pending a dedicated content-gap source.",
  "ai-visibility": "No AI-visibility signals in this run.",
  marketing: "Outcome signals require prior implementation history.",
};

interface PillarContribution {
  pillar: GrowthPillarId;
  title: string;
  evidenceIds: string[];
}

/**
 * Group the pre-collapse inputs into the six product pillars. Uses origin
 * (audit issue, citation gap, action source, …) — richer than the aggregator's
 * five flattened signal sources — so Search, Business and Marketing stay
 * distinct from Content in the narrative header.
 */
export function buildPillarSnapshot(
  result: AnalyzeResult,
  inputs: AggregatorInputs,
): PillarSummary[] {
  const contributions: PillarContribution[] = [
    ...inputs.auditIssues.map((issue) => ({
      pillar: "technical" as const,
      title: issue.title,
      evidenceIds: issue.evidenceIds,
    })),
    ...inputs.aiVisibility.map((summary) => ({
      pillar: "ai-visibility" as const,
      title: summary.topic,
      evidenceIds: summary.evidenceIds,
    })),
    ...inputs.citationGaps.map((gap) => ({
      pillar: "ai-visibility" as const,
      title: gap.title,
      evidenceIds: gap.evidenceIds,
    })),
    ...inputs.opportunities.map((opp) => ({
      pillar: "content" as const,
      title: opp.title,
      evidenceIds: opp.evidenceIds,
    })),
    ...inputs.outcomes.map((outcome) => ({
      pillar: "marketing" as const,
      title: outcome.recommendationTitle,
      evidenceIds: [] as string[],
    })),
    ...result.nextActions.map((action) => ({
      pillar: pillarForActionSource(action.source),
      title: action.title,
      evidenceIds: action.evidenceIds,
    })),
  ];

  return GROWTH_PILLARS.map((pillar) => {
    const own = contributions.filter((c) => c.pillar === pillar.id);
    const evidenceIds = [...new Set(own.flatMap((c) => c.evidenceIds))];
    return {
      id: pillar.id,
      label: pillar.label,
      signalCount: own.length,
      topSignalTitle: own[0]?.title ?? null,
      evidenceIds,
      labels: own.length === 0 ? [EMPTY_PILLAR_REASON[pillar.id]] : [],
    };
  });
}

/** v1 honesty note surfaced on every report while these sources are unwired. */
const PENDING_SOURCES_LABEL =
  "Content-opportunity and outcome signals are pending dedicated sources (v1).";

/**
 * Package one live `AnalyzeResult` into the unified Growth Intelligence report:
 * the six-pillar snapshot plus ranked cross-engine decisions, carrying honesty
 * labels, SEO guardrails and evidence IDs through untouched.
 */
export function buildGrowthIntelligenceReport(
  result: AnalyzeResult,
): GrowthIntelligenceReport {
  const inputs = toAggregatorInputs(result);
  const signals = buildGrowthSignals(inputs);
  const decisions = buildUnifiedGrowthDecisions(signals);
  const pillars = buildPillarSnapshot(result, inputs);

  return {
    domain: result.project.domain,
    generatedAt: new Date().toISOString(),
    pillars,
    decisions,
    guardrails: seoGuardrails,
    labels: [...(result.intelligence?.labels ?? []), PENDING_SOURCES_LABEL],
    evidenceIds: [...new Set(decisions.flatMap((decision) => decision.evidenceIds))],
  };
}
