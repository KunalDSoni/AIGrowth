// tests/unit/causal-estimator-synth.test.ts
import { describe, expect, it } from "vitest";
import { syntheticControl } from "@/lib/causal/estimator";
import { generatePair } from "@/tests/support/causal-synthetic";

describe("syntheticControl", () => {
  it("recovers a known lift and is always labelled directional/estimated", () => {
    const { treat, control, startedAt } = generatePair({
      baseline: 300,
      noise: 0.05,
      preDays: 28,
      postDays: 21,
      trueLiftPct: 12,
      seed: 11,
    });
    const r = syntheticControl(treat, control, startedAt);
    expect(r.method).toBe("synthetic_control");
    expect(r.basis).toBe("estimated");
    expect(r.label).toBe("directional_modeled");
    expect(r.liftPct).toBeGreaterThan(4);
    expect(r.liftPct).toBeLessThan(20);
  });
});
