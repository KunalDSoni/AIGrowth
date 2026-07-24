import { describe, expect, it } from "vitest";
import { buildCitationFixPlan } from "@/lib/engines/geo-citation-fix";
import { buildBrandGapDiff } from "@/lib/engines/geo-brand-gap-diff";
import type { AnswerFitnessFeatures, CitedSourceFeatureProfile } from "@/lib/engines/geo-cited-source-features";

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

function extracted(domain: string, prompts: string[], f: Partial<AnswerFitnessFeatures>): CitedSourceFeatureProfile {
  return {
    url: `https://${domain}/x`,
    domain,
    citedForPrompts: prompts,
    citationCount: prompts.length,
    crawlStatus: "extracted",
    features: features(f),
  };
}

describe("buildCitationFixPlan", () => {
  it("emits a fix per gap with taxonomy copy and correct fix type", () => {
    const diff = buildBrandGapDiff(features(), [extracted("a.com", ["p1"], { hasFaqStructure: true })]);
    const plan = buildCitationFixPlan(diff, { evidenceIds: ["ev-1"] });
    expect(plan.fixes).toHaveLength(1);
    const fix = plan.fixes[0];
    expect(fix.fixTypeId).toBe("faq-block");
    expect(fix.feature).toBe("hasFaqStructure");
    expect(fix.title.length).toBeGreaterThan(0);
    expect(fix.whatToCreate.length).toBeGreaterThan(0);
    expect(fix.whyItEarnsCitations.length).toBeGreaterThan(0);
    expect(fix.evidenceIds).toEqual(["ev-1"]);
  });

  it("ranks the more dominant / higher-impact gap first", () => {
    // direct-answer baseImpact 5 @ share 1.0 should beat freshness baseImpact 2 @ share 0.5
    const diff = buildBrandGapDiff(features(), [
      extracted("a.com", ["p1"], { hasDirectAnswer: true, hasFreshnessSignal: true }),
      extracted("b.com", ["p2"], { hasDirectAnswer: true }),
    ]);
    const plan = buildCitationFixPlan(diff);
    expect(plan.fixes[0].fixTypeId).toBe("direct-answer");
    expect(plan.fixes[0].priority).toBeGreaterThan(plan.fixes[1].priority);
  });

  it("assigns expected-lift bands by priority threshold", () => {
    const high = buildCitationFixPlan(
      buildBrandGapDiff(features(), [extracted("a.com", ["p1", "p2", "p3", "p4", "p5"], { hasDirectAnswer: true })]),
    );
    expect(high.fixes[0].expectedLiftBand).toBe("high");

    const low = buildCitationFixPlan(
      buildBrandGapDiff(features(), [
        extracted("a.com", ["p1"], { hasFreshnessSignal: true }),
        extracted("b.com", ["p2"], {}),
      ]),
    );
    expect(low.fixes[0].expectedLiftBand).toBe("low");
  });

  it("is Medium confidence when reliable and Low when not", () => {
    const diff = buildBrandGapDiff(features(), [extracted("a.com", ["p1"], { hasFaqStructure: true })]);
    expect(buildCitationFixPlan(diff).fixes[0].confidence).toBe("Medium");
    expect(buildCitationFixPlan(diff, { sampleReliable: false }).fixes[0].confidence).toBe("Low");
  });

  it("always includes directional and help-users-first assumptions", () => {
    const diff = buildBrandGapDiff(features(), [extracted("a.com", ["p1"], { hasFaqStructure: true })]);
    const assumptions = buildCitationFixPlan(diff).fixes[0].assumptions.join(" ").toLowerCase();
    expect(assumptions).toContain("directional");
    expect(assumptions).toContain("help users first");
  });

  it("returns no fixes with a note when there are no gaps", () => {
    const diff = buildBrandGapDiff(features({ hasFaqStructure: true }), [
      extracted("a.com", ["p1"], { hasFaqStructure: true }),
    ]);
    const plan = buildCitationFixPlan(diff);
    expect(plan.fixes).toEqual([]);
    expect(plan.note).toBeTruthy();
  });

  it("downgrades confidence and sets a note when the diff is unreliable", () => {
    const diff = buildBrandGapDiff(features(), [
      { url: "https://c.com/x", domain: "c.com", citedForPrompts: ["p1"], citationCount: 1, crawlStatus: "unreachable" },
    ]);
    const plan = buildCitationFixPlan(diff);
    expect(plan.reliable).toBe(false);
    expect(plan.note).toBeTruthy();
    expect(plan.fixes.every((f) => f.confidence === "Low")).toBe(true);
  });

  it("does not mutate the input diff", () => {
    const diff = buildBrandGapDiff(features(), [extracted("a.com", ["p1"], { hasFaqStructure: true })]);
    const snapshot = JSON.stringify(diff);
    buildCitationFixPlan(diff);
    expect(JSON.stringify(diff)).toBe(snapshot);
  });
});
