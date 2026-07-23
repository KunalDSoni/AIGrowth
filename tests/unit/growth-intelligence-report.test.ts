import { describe, expect, it } from "vitest";
import {
  GROWTH_PILLARS,
  buildGrowthIntelligenceReport,
  buildPillarSnapshot,
  emptyPillarSummaries,
  toAggregatorInputs,
} from "@/lib/engines/growth-intelligence-compose";
import type {
  AuditIssue,
  CitationGapAction,
  RecommendationScoreComponents,
} from "@/lib/domain/types";
import type { RankedCandidate } from "@/lib/engines/recommendation-bus";
import type { LiveIntelligence } from "@/lib/engines/live-intelligence";
import { makeAnalyzeResult } from "../support/analyze-input";

function scoreComponents(
  overrides: Partial<RecommendationScoreComponents> = {},
): RecommendationScoreComponents {
  return {
    businessRelevance: 70,
    conversionPotential: 60,
    discoveryOpportunity: 65,
    severity: 50,
    strategicAlignment: 70,
    urgency: 55,
    effort: 40,
    evidenceConfidence: 75,
    risk: 20,
    dependencyReadiness: 80,
    ...overrides,
  };
}

function rankedCandidate(id: string): RankedCandidate {
  return {
    id,
    source: "search",
    title: `Action ${id}`,
    action: "Do the thing",
    evidenceIds: [`ev-${id}`],
    scoreComponents: scoreComponents(),
    rank: 1,
    priorityScore: 80,
    impactScore: 75,
    feasibilityScore: 70,
    bucket: "high-impact",
    explanation: "because",
  };
}

const auditIssue: AuditIssue = {
  id: "ai-1",
  ruleId: "title-short",
  category: "metadata",
  severity: "high",
  title: "Title is short",
  description: "Short",
  recommendedAction: "Expand title",
  affectedPages: 1,
  evidenceIds: ["ev-crawl"],
  impactArea: "metadata",
};

const citationGap: CitationGapAction = {
  id: "cg-1",
  familyId: "fam-1",
  title: "No first-party citation",
  gapType: "first-party-page",
  explanation: "Answers cite competitors, not you.",
  recommendedAction: "Publish a citable service page.",
  evidenceIds: ["ev-geo"],
  citedDomains: ["competitor.example"],
  missingFirstPartyCitation: true,
  competitorCitations: ["competitor.example"],
  assumptions: [],
  measurementPlan: [],
  confidence: "Medium",
};

describe("GROWTH_PILLARS", () => {
  it("lists the six pillars in fixed product order with labels", () => {
    expect(GROWTH_PILLARS.map((p) => p.id)).toEqual([
      "search",
      "technical",
      "business",
      "content",
      "ai-visibility",
      "marketing",
    ]);
    for (const pillar of GROWTH_PILLARS) {
      expect(pillar.label.length).toBeGreaterThan(0);
    }
  });
});

describe("emptyPillarSummaries", () => {
  it("returns six zeroed summaries in the fixed pillar order", () => {
    const summaries = emptyPillarSummaries();
    expect(summaries.map((s) => s.id)).toEqual(GROWTH_PILLARS.map((p) => p.id));
    for (const summary of summaries) {
      expect(summary.signalCount).toBe(0);
      expect(summary.topSignalTitle).toBeNull();
      expect(summary.evidenceIds).toEqual([]);
      expect(summary.labels).toEqual([]);
    }
  });
});

describe("toAggregatorInputs", () => {
  it("passes audit issues, citation gaps and next actions straight through", () => {
    const base = makeAnalyzeResult();
    const result = {
      ...base,
      seo: { ...base.seo, siteIssues: [auditIssue] },
      nextActions: [rankedCandidate("a1")],
      intelligence: { citationGaps: [citationGap] } as unknown as LiveIntelligence,
    };

    const inputs = toAggregatorInputs(result);

    expect(inputs.auditIssues).toEqual([auditIssue]);
    expect(inputs.citationGaps).toEqual([citationGap]);
    expect(inputs.recommendations.map((r) => r.id)).toEqual(["a1"]);
    expect(inputs.recommendations[0].scoreComponents.businessRelevance).toBe(70);
  });

  it("derives one AI-visibility summary from the geo observations", () => {
    const result = makeAnalyzeResult({
      geoSampleSize: 3,
      brandMentionRate: 1,
      citedDomains: ["ref.example"],
    });

    const inputs = toAggregatorInputs(result);

    expect(inputs.aiVisibility).toHaveLength(1);
    expect(inputs.aiVisibility[0].sampleSize).toBe(3);
    expect(inputs.aiVisibility[0].brandMentionFrequency).toBe(100);
  });

  it("leaves opportunities and outcomes empty when no live source exists (v1)", () => {
    const inputs = toAggregatorInputs(makeAnalyzeResult());
    expect(inputs.opportunities).toEqual([]);
    expect(inputs.outcomes).toEqual([]);
  });

  it("returns no AI-visibility summary when there are no observations", () => {
    const base = makeAnalyzeResult();
    const result = { ...base, geo: { ...base.geo, observations: [] } };
    expect(toAggregatorInputs(result).aiVisibility).toEqual([]);
  });
});

describe("buildPillarSnapshot", () => {
  it("attributes contributors to pillars with counts, evidence and a top title", () => {
    const base = makeAnalyzeResult({ geoSampleSize: 2, brandMentionRate: 1 });
    const result = {
      ...base,
      seo: { ...base.seo, siteIssues: [auditIssue] },
      nextActions: [rankedCandidate("s1")], // source "search"
      intelligence: { citationGaps: [citationGap] } as unknown as LiveIntelligence,
    };
    const inputs = toAggregatorInputs(result);

    const pillars = buildPillarSnapshot(result, inputs);
    const by = Object.fromEntries(pillars.map((p) => [p.id, p]));

    expect(pillars.map((p) => p.id)).toEqual(GROWTH_PILLARS.map((p) => p.id));
    expect(by.technical.signalCount).toBe(1);
    expect(by.technical.topSignalTitle).toBe("Title is short");
    expect(by.technical.evidenceIds).toContain("ev-crawl");
    expect(by["ai-visibility"].signalCount).toBe(2); // 1 summary + 1 citation gap
    expect(by["ai-visibility"].evidenceIds).toContain("ev-geo");
    expect(by.search.signalCount).toBe(1);
    expect(by.content.signalCount).toBe(0);
    expect(by.business.signalCount).toBe(0);
    expect(by.marketing.signalCount).toBe(0);
  });

  it("labels each empty pillar with the reason it is empty", () => {
    const result = makeAnalyzeResult({ geoSampleSize: 0 });
    const pillars = buildPillarSnapshot(result, toAggregatorInputs(result));
    for (const pillar of pillars) {
      expect(pillar.signalCount).toBe(0);
      expect(pillar.topSignalTitle).toBeNull();
      expect(pillar.labels.length).toBeGreaterThan(0);
    }
  });
});

describe("buildGrowthIntelligenceReport", () => {
  it("assembles pillars, ranked decisions, guardrails, labels and evidence", () => {
    const base = makeAnalyzeResult({ geoSampleSize: 2, brandMentionRate: 0 });
    const result = {
      ...base,
      seo: { ...base.seo, siteIssues: [auditIssue] },
      nextActions: [rankedCandidate("s1")],
      intelligence: {
        citationGaps: [citationGap],
        labels: ["GEO directional only"],
      } as unknown as LiveIntelligence,
    };

    const report = buildGrowthIntelligenceReport(result);

    expect(report.domain).toBe(result.project.domain);
    expect(report.generatedAt.length).toBeGreaterThan(0);
    expect(report.pillars.map((p) => p.id)).toEqual(GROWTH_PILLARS.map((p) => p.id));
    expect(report.decisions.length).toBeGreaterThan(0);
    expect(report.decisions.length).toBeLessThanOrEqual(5);
    expect(report.guardrails.length).toBeGreaterThan(0);
    expect(report.labels).toContain("GEO directional only");
    expect(report.evidenceIds).toContain("ev-geo");
  });

  it("returns a valid empty report when the scan has no evidence", () => {
    const report = buildGrowthIntelligenceReport(makeAnalyzeResult({ geoSampleSize: 0 }));
    expect(report.decisions).toEqual([]);
    expect(report.evidenceIds).toEqual([]);
    expect(report.pillars.every((p) => p.signalCount === 0)).toBe(true);
    expect(report.guardrails.length).toBeGreaterThan(0); // guardrails always present
    expect(report.labels.length).toBeGreaterThan(0); // insufficiency stated
  });
});
