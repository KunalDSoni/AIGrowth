// tests/unit/causal-engine.test.ts
import { describe, expect, it } from "vitest";
import { runCausalTest } from "@/lib/causal/engine";
import type { OutcomeStreamProvider } from "@/lib/causal/outcomes";
import type { AccountConstraints, Intervention } from "@/lib/causal/types";
import { generatePair } from "@/tests/support/causal-synthetic";

const { treat, control, startedAt } = generatePair({
  baseline: 300,
  noise: 0.05,
  preDays: 21,
  postDays: 21,
  trueLiftPct: 15,
  seed: 5,
});

const intervention: Intervention = {
  id: "iv1",
  channel: "google_ads",
  hypothesis: "PMax lifts conversions",
  startedAt,
  geoScope: "treat",
};

const provider: OutcomeStreamProvider = {
  async fetch(scope) {
    return scope.geoScope === "control" ? control : treat;
  },
};

describe("runCausalTest", () => {
  it("returns a measured DiD lift for a powered multi-market account", async () => {
    const constraints: AccountConstraints = { markets: 3, dailyOutcomeVolume: 400, canPulseBudget: true };
    const report = await runCausalTest({ intervention, constraints, outcomes: provider, controlScope: "control" });
    expect(report.design.rung).toBe("geo_holdout");
    expect(report.lift?.method).toBe("diff_in_diff");
    expect(report.lift?.liftPct).toBeGreaterThan(5);
  });

  it("refuses to declare a winner when observational", async () => {
    const constraints: AccountConstraints = { markets: 1, dailyOutcomeVolume: 0, canPulseBudget: false };
    const report = await runCausalTest({ intervention, constraints, outcomes: provider, controlScope: "control" });
    expect(report.design.rung).toBe("observational");
    expect(report.lift).toBeNull();
    expect(report.honest).toMatch(/insufficient/i);
  });
});
