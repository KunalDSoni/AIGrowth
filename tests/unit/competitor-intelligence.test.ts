import { describe, expect, it } from "vitest";
import {
  correctCompetitor,
  detectCompetitorGaps,
  normalizeCompetitor,
  MIN_SAMPLE_SIZE,
} from "@/lib/engines/competitor-intelligence";
import type { AIVisibilityObservation } from "@/lib/domain/types";

function obs(partial: {
  brand?: boolean;
  competitors?: string[];
  citedDomains?: string[];
}): AIVisibilityObservation {
  return {
    id: Math.random().toString(36).slice(2),
    familyId: "f1",
    exactPrompt: "who is best?",
    platform: "ChatGPT",
    model: "mock-1",
    locale: "en-AU",
    runId: "run-1",
    observedAt: "2026-07-23T00:00:00.000Z",
    rawResponse: "…",
    brandMentions: partial.brand ? ["Northstar"] : [],
    competitorMentions: partial.competitors ?? [],
    citations: (partial.citedDomains ?? []).map((d) => ({ url: `https://${d}/x`, domain: d, title: d })),
    sentiment: "neutral",
    extractionConfidence: 0.8,
    isSimulated: true,
  };
}

describe("normalizeCompetitor", () => {
  it("keeps categories separate and defaults unknown type to business", () => {
    expect(normalizeCompetitor({ name: "X", type: "local" }).type).toBe("local");
    // @ts-expect-error deliberately invalid type
    expect(normalizeCompetitor({ name: "Y", type: "banana" }).type).toBe("business");
  });
});

describe("correctCompetitor", () => {
  it("applies a user correction at full confidence and records provenance", () => {
    const base = normalizeCompetitor({ name: "X", type: "organic", source: "ai" });
    const fixed = correctCompetitor(base, { type: "ai-answer", relevant: false });
    expect(fixed.type).toBe("ai-answer");
    expect(fixed.relevant).toBe(false);
    expect(fixed.confidence).toBe(100);
    expect(fixed.source).toMatch(/user-corrected/);
  });
});

describe("detectCompetitorGaps", () => {
  it("returns nothing below the minimum sample size", () => {
    const observations = Array.from({ length: MIN_SAMPLE_SIZE - 1 }, () =>
      obs({ competitors: ["Rival"] }),
    );
    expect(detectCompetitorGaps({ observations, competitors: ["Rival"], firstPartyDomain: "me.com" })).toEqual([]);
  });

  it("emits a mention gap when a competitor out-appears the user", () => {
    const observations = [
      obs({ competitors: ["Rival"] }),
      obs({ competitors: ["Rival"] }),
      obs({ competitors: ["Rival"] }),
      obs({ brand: true }),
    ];
    const gaps = detectCompetitorGaps({ observations, competitors: ["Rival"], firstPartyDomain: "me.com" });
    const mention = gaps.find((g) => g.gapType === "mention");
    expect(mention).toBeTruthy();
    expect(mention!.competitorRate).toBeGreaterThan(mention!.userRate);
    expect(mention!.sampleSize).toBe(4);
  });

  it("emits a citation gap when a competitor is cited and the user is not", () => {
    const observations = [
      obs({ citedDomains: ["rival.com"] }),
      obs({ citedDomains: ["rival.com"] }),
      obs({ citedDomains: ["rival.com"] }),
    ];
    const gaps = detectCompetitorGaps({ observations, competitors: ["rival.com"], firstPartyDomain: "me.com" });
    expect(gaps.some((g) => g.gapType === "citation")).toBe(true);
  });

  it("does not emit a gap when the user already leads", () => {
    const observations = [
      obs({ brand: true, citedDomains: ["me.com"] }),
      obs({ brand: true, citedDomains: ["me.com"] }),
      obs({ brand: true }),
    ];
    const gaps = detectCompetitorGaps({ observations, competitors: ["Rival"], firstPartyDomain: "me.com" });
    expect(gaps).toEqual([]);
  });
});
