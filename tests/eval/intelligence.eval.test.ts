import { describe, expect, it } from "vitest";
import { calculateRecommendationPriority } from "@/lib/engines/priority";
import { flagClaims } from "@/lib/engines/brief-builder";
import { summarizeAIVisibility } from "@/lib/engines/ai-visibility";
import { buildCitationGapActions } from "@/lib/engines/citation-gap";
import { MIN_SAMPLE_SIZE } from "@/lib/engines/competitor-intelligence";
import { runDeepMarketingEngine } from "@/lib/marketing/deep-engine";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";
import { makeAnalyzeResult } from "@/tests/support/analyze-input";
import type {
  AIVisibilityObservation,
  AIVisibilityPromptFamily,
  RecommendationScoreComponents,
} from "@/lib/domain/types";

/**
 * Evaluation harness.
 *
 * These assert *intelligence quality* invariants over real engine output, not
 * over a stored dataset. Inputs are minimal and neutral; the assertions are
 * about what the engines guarantee — grounded claims, bounded scores, honest
 * uncertainty — which is what separates an engine from a dashboard.
 */

const components = (over: Partial<RecommendationScoreComponents> = {}): RecommendationScoreComponents => ({
  businessRelevance: 80,
  conversionPotential: 80,
  discoveryOpportunity: 80,
  severity: 80,
  strategicAlignment: 80,
  urgency: 70,
  effort: 40,
  evidenceConfidence: 75,
  risk: 20,
  dependencyReadiness: 80,
  ...over,
});

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

describe("scoring invariants", () => {
  it("keeps priority scores within 0-100", () => {
    for (const over of [{}, { effort: 0 }, { effort: 100, risk: 100 }, { businessRelevance: 100 }]) {
      const score = calculateRecommendationPriority(components(over));
      expect(score.priorityScore).toBeGreaterThanOrEqual(0);
      expect(score.priorityScore).toBeLessThanOrEqual(100);
    }
  });

  it("ranks a stronger candidate above a weaker one deterministically", () => {
    const strong = calculateRecommendationPriority(components({ businessRelevance: 95, effort: 20 }));
    const weak = calculateRecommendationPriority(components({ businessRelevance: 40, effort: 90 }));
    expect(strong.priorityScore).toBeGreaterThan(weak.priorityScore);
  });
});

describe("answer-engine visibility honesty", () => {
  it("reports a sample size and a bounded mention frequency", () => {
    const [summary] = summarizeAIVisibility(
      [family],
      [observation("o1", true), observation("o2", false), observation("o3", true)],
      "Test Brand",
    );
    expect(summary.sampleSize).toBe(3);
    expect(summary.brandMentionFrequency).toBeGreaterThanOrEqual(0);
    expect(summary.brandMentionFrequency).toBeLessThanOrEqual(100);
  });

  it("never collapses visibility into a single magic score", () => {
    const [summary] = summarizeAIVisibility([family], [observation("o1", true)], "Test Brand");
    expect(summary.citedDomainFrequency).toBeDefined();
    expect(summary.competitorMentionFrequency).toBeDefined();
    expect(summary.sentimentDistribution).toBeDefined();
    expect(summary.recommendedAction.length).toBeGreaterThan(0);
  });

  it("does not claim High confidence below the sample-size threshold", () => {
    const observations = [observation("o1", false)];
    const summaries = summarizeAIVisibility([family], observations, "Test Brand");
    const actions = buildCitationGapActions({
      summaries,
      observations,
      firstPartyDomain: "example.invalid",
      competitors: ["Competitor One"],
      brand: "Test Brand",
    });
    expect(observations.length).toBeLessThan(MIN_SAMPLE_SIZE);
    for (const action of actions) {
      expect(action.confidence).not.toBe("High");
    }
  });
});

describe("claim safety", () => {
  it("flags fabricated authority and guarantees", () => {
    expect(flagClaims("We are the #1 award-winning firm and guarantee results.").length).toBeGreaterThan(0);
  });

  it("does not flag honest, verifiable copy", () => {
    expect(flagClaims("We prepare monthly management accounts and explain each figure.")).toHaveLength(0);
  });
});

describe("generated work is grounded", () => {
  it("grounds every campaign pack in observed site facts and never invents outreach", async () => {
    const result = makeAnalyzeResult({
      brand: "Test Brand",
      domain: "example.invalid",
      score: 68,
      critical: 2,
      high: 4,
    });
    result.intelligence = buildLiveIntelligence(result);

    const deep = await runDeepMarketingEngine(result, { hoursPerWeek: 8, useGemini: false });

    expect(deep.packs.length).toBeGreaterThan(0);
    for (const pack of deep.packs) {
      expect(pack.siteFactsUsed.length).toBeGreaterThan(0);
      for (const asset of pack.assets) {
        expect(asset.claimFlags).toBeDefined();
      }
    }

    // No citations were observed, so nothing may be invented to fill the gap.
    expect(deep.context.citedOthers).toEqual([]);
  });
});
