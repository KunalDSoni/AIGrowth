import { describe, expect, it } from "vitest";
import {
  createExperiment,
  posteriorMeans,
  recordOutcome,
  sampleBeta,
  selectArm,
  trafficShares,
} from "@/lib/bandit/thompson";

describe("Thompson Sampling bandit", () => {
  it("samples beta values in (0,1)", () => {
    for (let i = 0; i < 50; i++) {
      const v = sampleBeta(2, 5);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("keeps sticky assignments for the same visitor", () => {
    const experiment = createExperiment({
      id: "t1",
      name: "Test",
      arms: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
    });
    const first = selectArm(experiment, "visitor-1", () => 0.1);
    const second = selectArm(experiment, "visitor-1", () => 0.9);
    expect(second.armId).toBe(first.armId);
    expect(second.sticky).toBe(true);
  });

  it("updates alpha on convert and beta on fail", () => {
    const experiment = createExperiment({
      id: "t2",
      name: "Test",
      arms: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
    });
    recordOutcome(experiment, "a", true);
    recordOutcome(experiment, "a", false);
    const arm = experiment.arms.find((x) => x.id === "a")!;
    expect(arm.alpha).toBe(2);
    expect(arm.beta).toBe(2);
  });

  it("routes majority traffic to a strong arm after many conversions", () => {
    const experiment = createExperiment({
      id: "t3",
      name: "Test",
      arms: [
        { id: "winner", label: "Winner" },
        { id: "loser", label: "Loser" },
      ],
    });
    // Strong prior evidence for winner
    for (let i = 0; i < 40; i++) recordOutcome(experiment, "winner", true);
    for (let i = 0; i < 40; i++) recordOutcome(experiment, "loser", false);

    for (let i = 0; i < 200; i++) {
      selectArm(experiment, `v-${i}`);
    }
    const shares = trafficShares(experiment);
    expect(shares.winner).toBeGreaterThan(0.75);
    expect(shares.loser).toBeGreaterThan(0);
    expect(shares.loser).toBeLessThan(0.25);

    const means = posteriorMeans(experiment);
    expect(means.winner).toBeGreaterThan(means.loser);
  });
});
