import { describe, expect, it } from "vitest";
import { aggregateFixOutcomes, recordFixOutcome, type FixOutcome } from "@/lib/engines/geo-fix-outcomes";
import type { CitationLift, LiftLabel } from "@/lib/engines/geo-lift";
import type { AnswerFitnessFlag } from "@/lib/engines/geo-brand-gap-diff";

function lift(feature: AnswerFitnessFlag, label: LiftLabel, deltaShare: number, significant: boolean): CitationLift {
  return {
    fixId: `fix-${feature}`,
    feature,
    affectedPrompts: ["p1"],
    baseline: { answered: 4, brandCited: 0, citedShare: 0 },
    post: { answered: 4, brandCited: 3, citedShare: 0.75 },
    deltaShare,
    postInterval: null,
    pValue: significant ? 0.01 : 0.4,
    significant,
    label,
    note: "",
  };
}

describe("recordFixOutcome", () => {
  it("maps a lift to its fix type and marks a significant positive change a win", () => {
    const o = recordFixOutcome(lift("hasFaqStructure", "causal", 0.75, true));
    expect(o.fixTypeId).toBe("faq-block");
    expect(o.win).toBe(true);
  });

  it("does not mark a non-significant change a win", () => {
    expect(recordFixOutcome(lift("hasFaqStructure", "insufficient", 0.1, false)).win).toBe(false);
  });

  it("does not mark a significant negative change a win", () => {
    expect(recordFixOutcome(lift("hasFaqStructure", "directional", -0.2, true)).win).toBe(false);
  });
});

describe("aggregateFixOutcomes", () => {
  it("groups by fix type with win rate, causal wins and average delta", () => {
    const outcomes: FixOutcome[] = [
      recordFixOutcome(lift("hasFaqStructure", "causal", 0.5, true)),
      recordFixOutcome(lift("hasFaqStructure", "insufficient", 0.1, false)),
      recordFixOutcome(lift("hasStructuredPricing", "directional", 0.3, true)),
    ];
    const stats = aggregateFixOutcomes(outcomes);
    const faq = stats.find((s) => s.fixTypeId === "faq-block")!;
    expect(faq.trials).toBe(2);
    expect(faq.wins).toBe(1);
    expect(faq.causalWins).toBe(1);
    expect(faq.winRate).toBe(0.5);
    expect(faq.avgDeltaShare).toBe(0.3);
    const pricing = stats.find((s) => s.fixTypeId === "pricing-page")!;
    expect(pricing.wins).toBe(1);
  });

  it("returns an empty list for no outcomes", () => {
    expect(aggregateFixOutcomes([])).toEqual([]);
  });

  it("is ordered deterministically by fix type", () => {
    const stats = aggregateFixOutcomes([
      recordFixOutcome(lift("hasStructuredPricing", "causal", 0.3, true)),
      recordFixOutcome(lift("hasFaqStructure", "causal", 0.3, true)),
    ]);
    expect(stats.map((s) => s.fixTypeId)).toEqual(["faq-block", "pricing-page"]);
  });
});
