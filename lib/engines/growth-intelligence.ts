import type { AIVisibilitySummary, AuditIssue, CitationGapAction, ContentOpportunity, GrowthSignal, OutcomeLearningRecord, Recommendation, UnifiedGrowthDecision } from "@/lib/domain/types";
import { calculateRecommendationPriority } from "@/lib/engines/priority";

export const seoGuardrails = [
  "Use foundational SEO: crawlability, indexability, useful content, truthful structured data and clear internal links.",
  "Do not recommend keyword stuffing, artificial content length targets, or low-value pages for every prompt variation.",
  "Do not claim llms.txt, special AI schema, or artificial chunking improves Google AI-search visibility.",
  "Do not guarantee rankings, citations, mentions, traffic or conversions.",
  "AI-generated content must add original user value and must distinguish verified facts from claims needing review.",
];

function scoreSignal(signal: GrowthSignal) {
  return calculateRecommendationPriority({
    businessRelevance: signal.businessRelevance,
    conversionPotential: signal.conversionPotential,
    discoveryOpportunity: signal.discoveryOpportunity,
    severity: signal.urgency,
    strategicAlignment: signal.businessRelevance,
    urgency: signal.urgency,
    effort: signal.effort,
    evidenceConfidence: signal.evidenceStrength,
    risk: signal.risk,
    dependencyReadiness: 82,
  }).priorityScore;
}

export function buildGrowthSignals(input: {
  recommendations: Recommendation[];
  auditIssues: AuditIssue[];
  opportunities: ContentOpportunity[];
  aiVisibility: AIVisibilitySummary[];
  citationGaps: CitationGapAction[];
  outcomes: OutcomeLearningRecord[];
}): GrowthSignal[] {
  return [
    ...input.recommendations.map((item): GrowthSignal => ({
      id: `rec-${item.id}`,
      source: "content",
      title: item.title,
      evidenceIds: item.evidenceIds,
      businessRelevance: item.scoreComponents.businessRelevance,
      discoveryOpportunity: item.scoreComponents.discoveryOpportunity,
      conversionPotential: item.scoreComponents.conversionPotential,
      evidenceStrength: item.scoreComponents.evidenceConfidence,
      effort: item.scoreComponents.effort,
      risk: item.scoreComponents.risk,
      urgency: item.scoreComponents.urgency,
    })),
    ...input.auditIssues.map((issue): GrowthSignal => ({
      id: `audit-${issue.id}`,
      source: "technical",
      title: issue.title,
      evidenceIds: issue.evidenceIds,
      businessRelevance: issue.severity === "critical" ? 86 : 68,
      discoveryOpportunity: issue.impactArea === "metadata" || issue.impactArea === "internal-linking" ? 78 : 54,
      conversionPotential: issue.impactArea === "metadata" ? 72 : 45,
      evidenceStrength: 76,
      effort: issue.severity === "quick-win" ? 24 : 42,
      risk: 18,
      urgency: issue.severity === "critical" ? 88 : 62,
    })),
    ...input.opportunities.map((item): GrowthSignal => ({
      id: `content-${item.id}`,
      source: "content",
      title: item.title,
      evidenceIds: item.evidenceIds,
      businessRelevance: item.relevance,
      discoveryOpportunity: 100 - item.competition,
      conversionPotential: item.conversion,
      evidenceStrength: 64,
      effort: item.effort,
      risk: 28,
      urgency: item.funnel === "Decision" ? 76 : 62,
    })),
    ...input.aiVisibility.map((item): GrowthSignal => ({
      id: `aiv-${item.familyId}`,
      source: "ai-visibility",
      title: item.topic,
      evidenceIds: item.evidenceIds,
      businessRelevance: 82,
      discoveryOpportunity: 100 - item.brandMentionFrequency,
      conversionPotential: item.topic.toLowerCase().includes("provider") || item.topic.toLowerCase().includes("services") ? 80 : 62,
      evidenceStrength: Math.min(80, item.sampleSize * 18),
      effort: 52,
      risk: 34,
      urgency: 70,
    })),
    ...input.citationGaps.map((item): GrowthSignal => ({
      id: `citation-${item.id}`,
      source: "citation",
      title: item.title,
      evidenceIds: item.evidenceIds,
      businessRelevance: 80,
      discoveryOpportunity: item.missingFirstPartyCitation ? 88 : 64,
      conversionPotential: 72,
      evidenceStrength: item.confidence === "Medium" ? 64 : 42,
      effort: item.gapType === "first-party-page" ? 54 : 44,
      risk: 32,
      urgency: 66,
    })),
    ...input.outcomes.map((item): GrowthSignal => ({
      id: `outcome-${item.recommendationId}`,
      source: "outcome",
      title: item.recommendationTitle,
      evidenceIds: [],
      businessRelevance: 76,
      discoveryOpportunity: 42,
      conversionPotential: 70,
      evidenceStrength: item.outcomeConfidence === "Medium" ? 70 : 48,
      effort: 22,
      risk: 20,
      urgency: 56,
    })),
  ];
}

export function buildUnifiedGrowthDecisions(signals: GrowthSignal[]): UnifiedGrowthDecision[] {
  return [...signals]
    .sort((a, b) => scoreSignal(b) - scoreSignal(a))
    .slice(0, 5)
    .map((signal, index) => ({
      id: `decision-${signal.id}`,
      title: signal.title,
      decision: `${signal.source} signal ranked #${index + 1} by business relevance, opportunity, evidence strength, effort and risk.`,
      priorityScore: scoreSignal(signal),
      whyNow: signal.evidenceStrength >= 70 ? "Evidence is strong enough to act in the next sprint." : "Evidence is directional; keep assumptions visible and measure carefully.",
      sourceSignals: [signal.source],
      evidenceIds: signal.evidenceIds,
      guardrails: seoGuardrails,
      nextAction: signal.source === "ai-visibility" || signal.source === "citation" ? "Improve a useful first-party source page before trying to influence AI answers." : "Prepare the work, review claims, implement, and measure the comparison window.",
      measurement: "Track baseline, implementation date, leading indicators and comparison-period changes without claiming guaranteed causation.",
    }));
}

export function rejectUnsafeGrowthAction(text: string) {
  const lower = text.toLowerCase();
  return ["keyword stuffing", "llms.txt improves google", "special ai schema", "guarantee rankings", "one page for every prompt", "artificially chunk"].some((phrase) => lower.includes(phrase));
}
