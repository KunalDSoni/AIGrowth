import { describe, expect, it } from "vitest";
import { buildCitationFixPlan } from "@/lib/engines/geo-citation-fix";
import { buildBrandGapDiff } from "@/lib/engines/geo-brand-gap-diff";
import { fixTypeWeights } from "@/lib/engines/geo-fix-bandit";
import type { AnswerFitnessFeatures, CitedSourceFeatureProfile } from "@/lib/engines/geo-cited-source-features";
import type { FixTypeId } from "@/lib/engines/geo-fix-taxonomy";

function features(overrides: Partial<AnswerFitnessFeatures> = {}): AnswerFitnessFeatures {
  return {
    hasDirectAnswer: false,
    hasFaqStructure: false,
    hasComparisonContent: false,
    hasStructuredPricing: false,
    hasFreshnessSignal: false,
    hasStructuredData: false,
    hasProofSignal: false,
    wordCount: 500,
    ...overrides,
  };
}

// One competitor that has BOTH a direct-answer and a freshness signal, brand has neither.
function diffWithTwoGaps() {
  const profile: CitedSourceFeatureProfile = {
    url: "https://a.com/x",
    domain: "a.com",
    citedForPrompts: ["p1"],
    citationCount: 1,
    crawlStatus: "extracted",
    features: features({ hasDirectAnswer: true, hasFreshnessSignal: true }),
  };
  return buildBrandGapDiff(features(), [profile]);
}

describe("buildCitationFixPlan with learned weights (GIL-15)", () => {
  it("ranks direct-answer above freshness by default (static baseImpact prior)", () => {
    const plan = buildCitationFixPlan(diffWithTwoGaps());
    expect(plan.fixes[0].fixTypeId).toBe("direct-answer");
  });

  it("lets a proven winner outrank a higher static-impact fix", () => {
    const weights = { "freshness-refresh": 0.95, "direct-answer": 0.1 } as Record<FixTypeId, number>;
    const plan = buildCitationFixPlan(diffWithTwoGaps(), { weights });
    expect(plan.fixes[0].fixTypeId).toBe("freshness-refresh");
    expect(plan.fixes[0].priority).toBeGreaterThan(plan.fixes[1].priority);
  });

  it("leaves ranking unchanged when all weights are the neutral prior", () => {
    const weights = { "freshness-refresh": 0.5, "direct-answer": 0.5 } as Record<FixTypeId, number>;
    const plan = buildCitationFixPlan(diffWithTwoGaps(), { weights });
    expect(plan.fixes[0].fixTypeId).toBe("direct-answer");
  });

  it("accepts weights produced by the bandit end to end", () => {
    const weights = fixTypeWeights([
      { fixTypeId: "freshness-refresh", trials: 5, wins: 5, causalWins: 5, winRate: 1, avgDeltaShare: 0.4 },
      { fixTypeId: "direct-answer", trials: 5, wins: 0, causalWins: 0, winRate: 0, avgDeltaShare: 0 },
    ]);
    const plan = buildCitationFixPlan(diffWithTwoGaps(), { weights });
    expect(plan.fixes[0].fixTypeId).toBe("freshness-refresh");
  });
});
