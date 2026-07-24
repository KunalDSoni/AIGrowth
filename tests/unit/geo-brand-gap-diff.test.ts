import { describe, expect, it } from "vitest";
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

function extracted(
  domain: string,
  prompts: string[],
  f: Partial<AnswerFitnessFeatures>,
): CitedSourceFeatureProfile {
  return {
    url: `https://${domain}/x`,
    domain,
    citedForPrompts: prompts,
    citationCount: prompts.length,
    crawlStatus: "extracted",
    features: features(f),
  };
}

describe("buildBrandGapDiff", () => {
  it("flags a feature the brand lacks and competitors have as a gap", () => {
    const diff = buildBrandGapDiff(features({ hasFaqStructure: false }), [
      extracted("a.com", ["p1"], { hasFaqStructure: true }),
      extracted("b.com", ["p2"], { hasFaqStructure: true }),
      extracted("c.com", ["p3"], { hasFaqStructure: false }),
    ]);
    const faq = diff.gaps.find((g) => g.feature === "hasFaqStructure")!;
    expect(faq.isGap).toBe(true);
    expect(faq.competitorsWithFeature).toBe(2);
    expect(faq.competitorsProfiled).toBe(3);
    expect(faq.competitorShare).toBe(0.67);
    expect(faq.affectedPrompts.sort()).toEqual(["p1", "p2"]);
  });

  it("does not flag a feature the brand already has", () => {
    const diff = buildBrandGapDiff(features({ hasStructuredPricing: true }), [
      extracted("a.com", ["p1"], { hasStructuredPricing: true }),
    ]);
    expect(diff.gaps.find((g) => g.feature === "hasStructuredPricing")!.isGap).toBe(false);
  });

  it("does not flag a feature no competitor has", () => {
    const diff = buildBrandGapDiff(features(), [extracted("a.com", ["p1"], {})]);
    expect(diff.gaps.find((g) => g.feature === "hasProofSignal")!.isGap).toBe(false);
  });

  it("excludes unreachable profiles from the denominator", () => {
    const diff = buildBrandGapDiff(features(), [
      extracted("a.com", ["p1"], { hasComparisonContent: true }),
      extracted("b.com", ["p2"], { hasComparisonContent: true }),
      { url: "https://c.com/x", domain: "c.com", citedForPrompts: ["p3"], citationCount: 1, crawlStatus: "unreachable", note: "blocked" },
    ]);
    const cmp = diff.gaps.find((g) => g.feature === "hasComparisonContent")!;
    expect(cmp.competitorsProfiled).toBe(2);
    expect(cmp.competitorsWithFeature).toBe(2);
  });

  it("is not reliable and has no topGaps when nothing was extracted", () => {
    const diff = buildBrandGapDiff(features(), [
      { url: "https://c.com/x", domain: "c.com", citedForPrompts: ["p3"], citationCount: 1, crawlStatus: "unreachable" },
    ]);
    expect(diff.reliable).toBe(false);
    expect(diff.topGaps).toEqual([]);
    expect(diff.gaps.every((g) => g.competitorShare === 0)).toBe(true);
  });

  it("orders gaps first then by competitorShare desc; topGaps is the isGap subset", () => {
    const diff = buildBrandGapDiff(features(), [
      extracted("a.com", ["p1"], { hasFaqStructure: true, hasStructuredPricing: true }),
      extracted("b.com", ["p2"], { hasStructuredPricing: true }),
    ]);
    // pricing share 1.0 > faq share 0.5, both gaps
    expect(diff.topGaps[0].feature).toBe("hasStructuredPricing");
    expect(diff.topGaps[1].feature).toBe("hasFaqStructure");
    expect(diff.topGaps.every((g) => g.isGap)).toBe(true);
    // non-gap features come after gaps in the full list
    const firstNonGap = diff.gaps.findIndex((g) => !g.isGap);
    const lastGap = diff.gaps.map((g) => g.isGap).lastIndexOf(true);
    expect(firstNonGap).toBeGreaterThan(lastGap);
  });

  it("does not mutate inputs", () => {
    const brand = features();
    const profiles = [extracted("a.com", ["p1"], { hasFaqStructure: true })];
    const snapshot = JSON.stringify({ brand, profiles });
    buildBrandGapDiff(brand, profiles);
    expect(JSON.stringify({ brand, profiles })).toBe(snapshot);
  });
});
