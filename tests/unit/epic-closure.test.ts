import { describe, expect, it } from "vitest";
import { computeGeoVariability } from "@/lib/engines/geo-metrics";
import { buildLiveCitationGaps } from "@/lib/engines/live-citation-gaps";
import { diffCrawlPages } from "@/lib/engines/crawl-diff";
import { validateClaims, canApprove } from "@/lib/engines/claim-validation";
import { applyLearningFeedback } from "@/lib/engines/learning-feedback";
import type { AnalyzeDelta } from "@/lib/engines/analyze-delta";
import type { RankedCandidate } from "@/lib/engines/recommendation-bus";
import type { GeoResult } from "@/lib/analyze/types";

const geo: GeoResult = {
  runId: "r1",
  model: "m",
  sampleSize: 4,
  brandMentionRate: 25,
  firstPartyCitationShare: 0,
  observations: [
    {
      id: "1",
      prompt: "a",
      rawResponse: "Rival is best https://rival.test/",
      brandMentioned: false,
      citations: [{ url: "https://rival.test/", domain: "rival.test", classification: "other" }],
    },
    {
      id: "2",
      prompt: "b",
      rawResponse: "Acme is recommended",
      brandMentioned: true,
      citations: [],
    },
    {
      id: "3",
      prompt: "c",
      rawResponse: "Avoid poor options",
      brandMentioned: false,
      citations: [{ url: "https://other.test/", domain: "other.test", classification: "other" }],
    },
    {
      id: "4",
      prompt: "d",
      rawResponse: "neutral text",
      brandMentioned: false,
      citations: [],
    },
  ],
  errors: [],
  cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 },
};

describe("remaining epic engines", () => {
  it("computes GEO variability metrics", () => {
    const metrics = computeGeoVariability(geo, [
      {
        analyzedAt: "2026-07-01T00:00:00.000Z",
        brandGuess: "Acme",
        domain: "acme.test",
        seo: { score: 70, band: "good", pagesScanned: 2, totalIssues: 1, critical: 0, high: 1, quickWins: 0 },
        geo: { runId: "old", model: "m", sampleSize: 4, brandMentionRate: 50, firstPartyCitationShare: 10 },
        nextActionIds: [],
        topActionTitles: [],
      },
    ]);
    expect(metrics.sampleSize).toBe(4);
    expect(metrics.sentimentDistribution.negative).toBeGreaterThanOrEqual(1);
    expect(metrics.runToRunMentionStdev).not.toBeNull();
    expect(metrics.confidence).toBe("Low");
  });

  it("builds live citation gaps without Northstar copy", () => {
    const gaps = buildLiveCitationGaps({
      geo,
      brand: "Acme",
      domain: "acme.test",
      evidenceIds: ["ev-1"],
    });
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.every((g) => !/northstar/i.test(g.title + g.explanation))).toBe(true);
  });

  it("diffs crawl inventories", () => {
    const diff = diffCrawlPages(
      [{ url: "https://a.test/", title: "Home", score: 80 }],
      [
        { url: "https://a.test/", title: "Home", score: 70 },
        { url: "https://a.test/new", title: "New", score: 60 },
      ],
    );
    expect(diff.added).toHaveLength(1);
    expect(diff.changed).toHaveLength(1);
    expect(diff.removed).toHaveLength(0);
  });

  it("validates claims and blocks approval", () => {
    const flags = validateClaims("We are the world's best with 90% growth guaranteed ranking.");
    expect(flags.some((f) => f.severity === "block")).toBe(true);
    expect(canApprove(flags, false)).toBe(false);
    expect(canApprove(flags, true)).toBe(true);
  });

  it("applies learning feedback multipliers", () => {
    const actions: RankedCandidate[] = [
      {
        id: "geo-1",
        source: "ai-visibility",
        title: "GEO gap",
        action: "fix",
        evidenceIds: ["e"],
        scoreComponents: {
          businessRelevance: 70,
          conversionPotential: 50,
          discoveryOpportunity: 80,
          severity: 60,
          strategicAlignment: 60,
          urgency: 50,
          effort: 40,
          evidenceConfidence: 50,
          risk: 30,
          dependencyReadiness: 80,
        },
        rank: 1,
        priorityScore: 50,
        impactScore: 60,
        feasibilityScore: 50,
        bucket: "monitor",
        explanation: "base",
      },
    ];
    const delta: AnalyzeDelta = {
      baselineAt: "a",
      comparisonAt: "b",
      brandGuess: "Acme",
      domain: "acme.test",
      metrics: [
        {
          key: "brandMentionRate",
          label: "mention",
          before: 40,
          after: 20,
          delta: -20,
          unit: "%",
          direction: "down",
          improved: false,
          higherIsBetter: true,
          significant: true,
        },
      ],
      actionsResolved: [],
      actionsNew: [],
      summary: "worse",
      confidence: "Low",
      attributionLimits: "x",
      followUp: "y",
    };
    const next = applyLearningFeedback(actions, delta);
    expect(next[0].priorityScore).toBeGreaterThan(50);
    expect(next[0].explanation).toMatch(/Learning adjustment/);
  });
});
