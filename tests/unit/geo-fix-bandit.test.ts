import { describe, expect, it } from "vitest";
import { buildFixTypeExperiment, fixTypeWeights } from "@/lib/engines/geo-fix-bandit";
import type { FixTypeOutcomeStat } from "@/lib/engines/geo-fix-outcomes";

function stat(fixTypeId: FixTypeOutcomeStat["fixTypeId"], trials: number, wins: number): FixTypeOutcomeStat {
  return { fixTypeId, trials, wins, causalWins: wins, winRate: trials ? wins / trials : 0, avgDeltaShare: 0.3 };
}

describe("geo fix-type bandit", () => {
  it("creates one arm per fix type and updates the posterior from wins/losses", () => {
    const exp = buildFixTypeExperiment([stat("faq-block", 4, 3)]);
    expect(exp.arms).toHaveLength(7);
    const faq = exp.arms.find((a) => a.id === "faq-block")!;
    expect(faq.alpha).toBe(1 + 3); // prior 1 + 3 wins
    expect(faq.beta).toBe(1 + 1); // prior 1 + 1 loss
  });

  it("weights a consistently winning fix type above a losing one", () => {
    const weights = fixTypeWeights([stat("faq-block", 5, 5), stat("pricing-page", 5, 0)]);
    expect(weights["faq-block"]).toBeGreaterThan(weights["pricing-page"]);
  });

  it("keeps untried fix types at the uniform prior weight 0.5", () => {
    const weights = fixTypeWeights([stat("faq-block", 5, 5)]);
    expect(weights["proof-block"]).toBe(0.5);
  });

  it("keeps every weight strictly within (0,1)", () => {
    const weights = fixTypeWeights([stat("faq-block", 5, 5), stat("pricing-page", 5, 0)]);
    for (const w of Object.values(weights)) {
      expect(w).toBeGreaterThan(0);
      expect(w).toBeLessThan(1);
    }
  });

  it("is deterministic", () => {
    const s = [stat("faq-block", 3, 2)];
    expect(fixTypeWeights(s)).toEqual(fixTypeWeights(s));
  });
});
