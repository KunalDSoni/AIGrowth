// tests/unit/causal-estimator-did.test.ts
import { describe, expect, it } from "vitest";
import { diffInDiff } from "@/lib/causal/estimator";
import { generatePair } from "@/tests/support/causal-synthetic";

describe("diffInDiff", () => {
  it("recovers a known lift within its confidence interval", () => {
    const { treat, control, startedAt } = generatePair({
      baseline: 200,
      noise: 0.05,
      preDays: 21,
      postDays: 21,
      trueLiftPct: 15,
      seed: 42,
    });
    const r = diffInDiff(treat, control, startedAt, "high_causal");
    expect(r.method).toBe("diff_in_diff");
    expect(r.basis).toBe("measured");
    expect(r.liftPct).toBeGreaterThan(5);
    expect(r.liftPct).toBeLessThan(25);
    expect(r.interval.low).toBeLessThanOrEqual(15);
    expect(r.interval.high).toBeGreaterThanOrEqual(15);
  });

  it("nets out a market-wide drift shared by both arms", () => {
    const { treat, control, startedAt } = generatePair({
      baseline: 200,
      noise: 0,
      preDays: 14,
      postDays: 14,
      trueLiftPct: 10,
      controlDrift: 1.5, // both arms jump 50%; DiD should still report ~10%
    });
    const r = diffInDiff(treat, control, startedAt, "high_causal");
    expect(r.liftPct).toBeCloseTo(10, 0);
  });
});
