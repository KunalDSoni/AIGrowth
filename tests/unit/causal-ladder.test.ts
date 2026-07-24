// tests/unit/causal-ladder.test.ts
import { describe, expect, it } from "vitest";
import { selectDesign } from "@/lib/causal/ladder";
import type { AccountConstraints } from "@/lib/causal/types";

const powered: AccountConstraints = { markets: 3, dailyOutcomeVolume: 400, canPulseBudget: true };

describe("selectDesign", () => {
  it("picks geo_holdout when multi-market and adequately powered", () => {
    const d = selectDesign(powered, 21);
    expect(d.rung).toBe("geo_holdout");
    expect(d.label).toBe("high_causal");
  });

  it("picks time_pulse for a single powered market that can pulse budget", () => {
    const d = selectDesign({ ...powered, markets: 1 }, 21);
    expect(d.rung).toBe("time_pulse");
    expect(d.label).toBe("good_causal_temporal");
  });

  it("falls back to synthetic_control when underpowered but some volume exists", () => {
    const d = selectDesign({ markets: 1, dailyOutcomeVolume: 3, canPulseBudget: false }, 21);
    expect(d.rung).toBe("synthetic_control");
    expect(d.label).toBe("directional_modeled");
  });

  it("returns observational/insufficient with no volume", () => {
    const d = selectDesign({ markets: 1, dailyOutcomeVolume: 0, canPulseBudget: false }, 21);
    expect(d.rung).toBe("observational");
    expect(d.label).toBe("insufficient");
  });
});
