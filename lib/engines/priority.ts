import type { AuditIssue, ContentOpportunity, Recommendation, RecommendationScoreComponents, Severity } from "@/lib/domain/types";

export interface PriorityInputs {
  businessImpact: number;
  confidence: number;
  strategicRelevance: number;
  effort: number;
}

export function calculatePriorityScore(input: PriorityInputs): number {
  const effort = Math.max(1, input.effort);
  const raw = (input.businessImpact * input.confidence * input.strategicRelevance) / effort;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

const clamp = (value: number) => Math.min(100, Math.max(0, value));

export function calculateRecommendationPriority(components: RecommendationScoreComponents) {
  const impactScore =
    clamp(components.businessRelevance) * 0.3 +
    clamp(components.conversionPotential) * 0.2 +
    clamp(components.discoveryOpportunity) * 0.15 +
    clamp(components.severity) * 0.15 +
    clamp(components.strategicAlignment) * 0.1 +
    clamp(components.urgency) * 0.1;

  const feasibilityScore =
    (100 - clamp(components.effort)) * 0.4 +
    clamp(components.evidenceConfidence) * 0.3 +
    (100 - clamp(components.risk)) * 0.2 +
    clamp(components.dependencyReadiness) * 0.1;

  return {
    impactScore: Math.round(impactScore),
    feasibilityScore: Math.round(feasibilityScore),
    priorityScore: Math.round((impactScore / 100) * (feasibilityScore / 100) * 100),
  };
}

export function explainRecommendationScore(components: RecommendationScoreComponents): string {
  const score = calculateRecommendationPriority(components);
  return `Impact ${score.impactScore}/100 x feasibility ${score.feasibilityScore}/100 = priority ${score.priorityScore}/100. Evidence confidence, effort and risk adjust the business impact so this remains a decision-support score, not a forecast.`;
}

const order: Severity[] = ["critical", "high", "quick-win", "monitor", "ignore"];

export function groupRecommendations(items: Recommendation[]) {
  return order.map((severity) => ({
    severity,
    items: items.filter((item) => item.severity === severity).sort((a, b) => b.priorityScore - a.priorityScore),
  }));
}

export function normalizeAuditIssue(input: Partial<AuditIssue> & Pick<AuditIssue, "id" | "title">): AuditIssue {
  return {
    id: input.id,
    ruleId: input.ruleId?.trim() || "general.review",
    title: input.title.trim(),
    category: input.category?.trim() || "General",
    severity: order.includes(input.severity as Severity) ? (input.severity as Severity) : "monitor",
    description: input.description?.trim() || "Review this item during the next optimization cycle.",
    recommendedAction: input.recommendedAction?.trim() || "Review the evidence and decide whether this belongs in the next implementation cycle.",
    affectedPages: Math.max(0, Math.floor(input.affectedPages ?? 0)),
    evidenceIds: input.evidenceIds ?? [],
    impactArea: input.impactArea ?? "discovery",
  };
}

export function opportunityScore(item: ContentOpportunity): number {
  const value = item.relevance * 0.3 + item.conversion * 0.3 + item.authority * 0.2 + (100 - item.competition) * 0.1 + (100 - item.effort) * 0.1;
  return Math.round(value);
}

export function rankOpportunities(items: ContentOpportunity[]) {
  return [...items].sort((a, b) => opportunityScore(b) - opportunityScore(a));
}
