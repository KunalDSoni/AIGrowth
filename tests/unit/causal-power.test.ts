// tests/unit/causal-power.test.ts
import { describe, expect, it } from "vitest";
import { feasibility } from "@/lib/causal/power";
import type { AccountConstraints } from "@/lib/causal/types";

const base: AccountConstraints = { markets: 2, dailyOutcomeVolume: 100, canPulseBudget: true };

describe("feasibility", () => {
  it("more volume shrinks the minimum detectable effect", () => {
    const low = feasibility({ ...base, dailyOutcomeVolume: 10 }, 21);
    const high = feasibility({ ...base, dailyOutcomeVolume: 1000 }, 21);
    expect(high.minDetectableEffectPct).toBeLessThan(low.minDetectableEffectPct);
  });

  it("flags underpowered when volume is tiny", () => {
    const f = feasibility({ ...base, dailyOutcomeVolume: 1 }, 7);
    expect(f.adequatelyPowered).toBe(false);
  });

  it("flags adequately powered with ample volume", () => {
    const f = feasibility({ ...base, dailyOutcomeVolume: 500 }, 28);
    expect(f.adequatelyPowered).toBe(true);
    expect(f.minDetectableEffectPct).toBeLessThanOrEqual(20);
  });

  it("returns Infinity MDE for zero volume", () => {
    const f = feasibility({ ...base, dailyOutcomeVolume: 0 }, 21);
    expect(f.minDetectableEffectPct).toBe(Number.POSITIVE_INFINITY);
    expect(f.adequatelyPowered).toBe(false);
  });
});
