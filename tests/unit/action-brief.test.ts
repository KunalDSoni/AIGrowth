import { describe, it, expect } from "vitest";
import { buildActionBrief } from "@/lib/engines/action-brief";
import type { AnalyzeResult } from "@/lib/analyze/types";
import type { RankedCandidate } from "@/lib/engines/recommendation-bus";

function fixture(): { result: AnalyzeResult; action: RankedCandidate } {
  const result: AnalyzeResult = {
    project: { id: "p", domain: "dosacc.com", brandGuess: "DiligenceOS", url: "https://dosacc.com/" },
    seo: {
      site: {
        score: 90,
        band: "excellent",
        pagesScanned: 2,
        pagesFailed: 0,
        totalIssues: 0,
        critical: 0,
        high: 0,
        quickWins: 0,
        worstPages: [],
        topIssues: [],
      },
      pages: [
        {
          url: "https://dosacc.com/",
          finalUrl: "https://dosacc.com/",
          title: "DiligenceOS",
          ok: true,
          metrics: { score: 90, band: "excellent", total: 0, critical: 0, high: 0, monitor: 0, quickWins: 0 },
          issues: [],
        },
      ],
      siteIssues: [],
      scannedAt: "2026-07-23T00:00:00.000Z",
      finalUrl: "https://dosacc.com/",
      origin: "https://dosacc.com",
    },
    geo: {
      runId: "g1",
      model: "gemini-flash-latest",
      sampleSize: 2,
      brandMentionRate: 0,
      firstPartyCitationShare: 0,
      observations: [
        {
          id: "o1",
          prompt: "Best bookkeeping providers",
          rawResponse: "See https://other.example/",
          brandMentioned: false,
          citations: [{ url: "https://other.example/", domain: "other.example", classification: "other" }],
        },
      ],
      errors: [],
      cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 },
    },
    evidence: [
      {
        id: "ev-gemini-answers",
        organizationId: "o",
        projectId: "p",
        kind: "AI_ANSWER_OBSERVATION",
        source: "gemini",
        retrievedAt: "2026-07-23",
        reliability: "MEDIUM",
        isEstimated: false,
        isSimulated: false,
        summary: "live answers",
      },
      {
        id: "ev-gemini-citations",
        organizationId: "o",
        projectId: "p",
        kind: "CITATION_OBSERVATION",
        source: "extract",
        retrievedAt: "2026-07-23",
        reliability: "MEDIUM",
        isEstimated: true,
        isSimulated: false,
        summary: "citations",
      },
    ],
    nextActions: [],
    guardrails: [],
    analyzedAt: "2026-07-23T00:00:00.000Z",
  };

  const action: RankedCandidate = {
    id: "geo-citation-gap",
    source: "citation",
    title: "AI answers cite other domains, not yours",
    action: "Strengthen citeable first-party pages",
    evidenceIds: ["ev-gemini-answers", "ev-gemini-citations"],
    scoreComponents: {
      businessRelevance: 80,
      conversionPotential: 60,
      discoveryOpportunity: 88,
      severity: 65,
      strategicAlignment: 70,
      urgency: 60,
      effort: 60,
      evidenceConfidence: 55,
      risk: 30,
      dependencyReadiness: 80,
    },
    rank: 1,
    priorityScore: 70,
    impactScore: 70,
    feasibilityScore: 60,
    bucket: "high-impact",
    explanation: "test",
  };

  return { result, action };
}

describe("buildActionBrief", () => {
  it("builds brief with site facts, outline, and citation domains", () => {
    const { result, action } = fixture();
    const pkg = buildActionBrief(result, action);
    expect(pkg.brief.recommendationId).toBe("geo-citation-gap");
    expect(pkg.brief.evidenceIds.length).toBeGreaterThan(0);
    expect(pkg.outline.length).toBeGreaterThan(3);
    expect(pkg.siteFacts.some((f) => f.includes("DiligenceOS"))).toBe(true);
    expect(pkg.citedOtherDomains).toContain("other.example");
    expect(pkg.suggestedTitle.length).toBeGreaterThan(5);
  });
});
