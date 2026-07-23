import { describe, expect, it } from "vitest";
import {
  calculateRecommendationPriority,
  explainRecommendationScore,
  groupRecommendations,
  normalizeAuditIssue,
  opportunityScore,
  rankOpportunities,
} from "@/lib/engines/priority";
import { summarizeAIVisibility } from "@/lib/engines/ai-visibility";
import { buildTechnicalAuditIssues } from "@/lib/engines/technical-audit";
import {
  rejectUnsafeGrowthAction,
  seoGuardrails,
  buildGrowthSignals,
  buildUnifiedGrowthDecisions,
} from "@/lib/engines/growth-intelligence";
import type {
  AIVisibilityObservation,
  AIVisibilityPromptFamily,
  ContentOpportunity,
  Recommendation,
  RecommendationScoreComponents,
  Severity,
  TechnicalPageObservation,
} from "@/lib/domain/types";

const components = (over: Partial<RecommendationScoreComponents> = {}): RecommendationScoreComponents => ({
  businessRelevance: 90,
  conversionPotential: 88,
  discoveryOpportunity: 86,
  severity: 90,
  strategicAlignment: 88,
  urgency: 80,
  effort: 40,
  evidenceConfidence: 80,
  risk: 20,
  dependencyReadiness: 80,
  ...over,
});

function recommendation(id: string, severity: Severity, rank: number): Recommendation {
  const score = calculateRecommendationPriority(components());
  return {
    id,
    rank,
    category: "Content",
    severity,
    title: `Action ${id}`,
    explanation: "Explanation",
    action: "Do the thing",
    impact: "High",
    effort: "Medium",
    effortScore: 40,
    confidence: "High",
    priorityScore: score.priorityScore,
    outcome: "More qualified enquiries",
    metrics: [{ label: "clicks", value: "100" }],
    assetType: "Page",
    status: "open",
    scoreComponents: components(),
    scoreExplanation: "explained",
    evidenceIds: ["ev-1"],
    assumptions: ["Traffic stays stable"],
    dependencies: [],
    risk: "Low",
    completionCriteria: ["Page published and indexed"],
    measurementPlan: {
      baseline: "Prior 28 days",
      implementationEvent: "Page published",
      comparisonWindow: "28 days after publish",
      leadingIndicators: ["impressions"],
      successSignals: ["qualified enquiries"],
      attributionLimits: "Directional comparison only",
    },
  };
}

describe("recommendation intelligence scoring", () => {
  it("derives priority from impact and feasibility components", () => {
    const score = calculateRecommendationPriority(components());
    expect(score.impactScore).toBeGreaterThan(85);
    expect(score.feasibilityScore).toBeGreaterThan(65);
    expect(score.priorityScore).toBeGreaterThan(0);
    expect(score.priorityScore).toBeLessThanOrEqual(100);
  });

  it("explains the score as decision support", () => {
    expect(explainRecommendationScore(components())).toContain("decision-support score");
  });

  it("scores lower when effort and risk rise", () => {
    const easy = calculateRecommendationPriority(components({ effort: 10, risk: 5 }));
    const hard = calculateRecommendationPriority(components({ effort: 95, risk: 90 }));
    expect(hard.priorityScore).toBeLessThan(easy.priorityScore);
  });
});

describe("recommendation grouping", () => {
  it("groups in decision order", () => {
    const groups = groupRecommendations([
      recommendation("a", "high", 2),
      recommendation("b", "critical", 1),
      recommendation("c", "monitor", 3),
    ]);
    expect(groups.map((g) => g.severity)).toEqual([
      "critical",
      "high",
      "quick-win",
      "monitor",
      "ignore",
    ]);
    expect(groups[0].items[0].id).toBe("b");
    expect(groups[1].items[0].id).toBe("a");
  });
});

describe("audit normalization", () => {
  it("applies safe defaults", () => {
    expect(normalizeAuditIssue({ id: "1", title: "  Check me  ", affectedPages: -2 })).toMatchObject({
      title: "Check me",
      category: "General",
      severity: "monitor",
      affectedPages: 0,
    });
  });
});

describe("technical audit rules", () => {
  const page = (over: Partial<TechnicalPageObservation> = {}): TechnicalPageObservation =>
    ({
      id: over.id ?? "p1",
      url: over.url ?? "https://example.invalid/",
      statusCode: 200,
      title: "Same title",
      description: "Same description",
      h1Count: 1,
      wordCount: 800,
      hasViewport: true,
      hasStructuredData: false,
      imageCount: 4,
      imagesMissingAlt: 2,
      internalLinkCount: 1,
      pageType: "service",
      ...over,
    }) as TechnicalPageObservation;

  const evidenceIds = {
    metadata: "ev-tech-metadata",
    schema: "ev-tech-schema",
    links: "ev-tech-links",
    alt: "ev-tech-alt",
    performance: "ev-tech-performance",
  };

  it("flags duplicated metadata across pages", () => {
    const issues = buildTechnicalAuditIssues({
      pages: [page({ id: "p1" }), page({ id: "p2", url: "https://example.invalid/b" })],
      evidenceIds,
    });
    expect(issues.some((issue) => issue.id === "meta")).toBe(true);
    expect(issues.every((issue) => issue.evidenceIds.length > 0)).toBe(true);
  });

  it("removes the metadata issue when page metadata is unique", () => {
    const issues = buildTechnicalAuditIssues({
      pages: [
        page({ id: "p1", title: "Unique 1", description: "Description 1" }),
        page({ id: "p2", url: "https://example.invalid/b", title: "Unique 2", description: "Description 2" }),
      ],
      evidenceIds,
    });
    expect(issues.some((issue) => issue.id === "meta")).toBe(false);
  });
});

describe("opportunity ranking", () => {
  const opportunity = (id: string, relevance: number): ContentOpportunity =>
    ({
      id,
      title: `Opportunity ${id}`,
      relevance,
      conversion: relevance,
      authority: relevance,
      competition: 50,
      effort: 40,
      evidenceIds: ["ev-1", "ev-2", "ev-3"],
    }) as ContentOpportunity;

  it("ranks by weighted business fit", () => {
    const ranked = rankOpportunities([opportunity("low", 40), opportunity("high", 95)]);
    expect(ranked[0].id).toBe("high");
    expect(opportunityScore(ranked[0])).toBeGreaterThan(opportunityScore(ranked.at(-1)!));
  });
});

describe("ai visibility summaries", () => {
  const family: AIVisibilityPromptFamily = {
    id: "fam-1",
    topic: "Topic",
    buyingStage: "decision",
    persona: "Buyer",
    geography: "Global",
    prompts: ["a", "b", "c"],
  };

  const observation = (id: string, mentionsBrand: boolean): AIVisibilityObservation => ({
      id,
      familyId: "fam-1",
      exactPrompt: "a",
      platform: "ChatGPT",
      model: "test-model",
      locale: "Global",
      runId: "run-1",
      observedAt: "2026-07-23T00:00:00.000Z",
      rawResponse: "response",
      brandMentions: mentionsBrand ? ["Test Brand"] : [],
      competitorMentions: ["Competitor One"],
      citations: [{ url: "https://reference.invalid/a", domain: "reference.invalid", title: "Reference" }],
      sentiment: mentionsBrand ? "positive" : "neutral",
      extractionConfidence: 80,
      isSimulated: false,
    });

  it("summarizes sample size and mention rate against the supplied brand", () => {
    const observations = [observation("o1", true), observation("o2", false), observation("o3", true)];
    const [summary] = summarizeAIVisibility([family], observations, "Test Brand");

    expect(summary.sampleSize).toBe(3);
    expect(summary.brandMentionFrequency).toBe(67);
    expect(summary.evidenceIds).toHaveLength(3);
    expect(summary.citedDomainFrequency["reference.invalid"]).toBe(3);
  });

  it("reports zero mentions for a brand that never appears", () => {
    const [summary] = summarizeAIVisibility([family], [observation("o1", false)], "Absent Brand");
    expect(summary.brandMentionFrequency).toBe(0);
    expect(summary.conclusion).toContain("Absent Brand");
  });
});

describe("growth guardrails", () => {
  it("rejects unsafe AI SEO shortcuts", () => {
    expect(rejectUnsafeGrowthAction("Add llms.txt improves Google AI visibility")).toBe(true);
    expect(rejectUnsafeGrowthAction("Create one page for every prompt variation")).toBe(true);
    expect(rejectUnsafeGrowthAction("Improve a useful service page with verified evidence")).toBe(false);
  });

  it("attaches guardrails to every unified decision", () => {
    const signals = buildGrowthSignals({
      recommendations: [recommendation("a", "critical", 1)],
      auditIssues: [],
      opportunities: [],
      aiVisibility: [],
      citationGaps: [],
      outcomes: [],
    });
    const decisions = buildUnifiedGrowthDecisions(signals);
    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions[0].guardrails).toEqual(seoGuardrails);
  });
});
