// tests/unit/causal-synthetic.test.ts
import { describe, expect, it } from "vitest";
import { generatePair } from "@/tests/support/causal-synthetic";

describe("generatePair", () => {
  it("is deterministic for a fixed seed", () => {
    const a = generatePair({ baseline: 100, noise: 0.1, preDays: 14, postDays: 14, trueLiftPct: 20, seed: 7 });
    const b = generatePair({ baseline: 100, noise: 0.1, preDays: 14, postDays: 14, trueLiftPct: 20, seed: 7 });
    expect(a.treat.points).toEqual(b.treat.points);
  });

  it("produces preDays+postDays points per arm and a startedAt at the boundary", () => {
    const { treat, control, startedAt } = generatePair({ baseline: 50, noise: 0, preDays: 10, postDays: 10, trueLiftPct: 0 });
    expect(treat.points).toHaveLength(20);
    expect(control.points).toHaveLength(20);
    expect(Date.parse(startedAt)).toBe(Date.parse(treat.points[10].period));
  });

  it("with zero noise, treat post reflects the true lift over control", () => {
    const { treat, control } = generatePair({ baseline: 100, noise: 0, preDays: 5, postDays: 5, trueLiftPct: 25 });
    expect(treat.points[6].value).toBeCloseTo(control.points[6].value * 1.25, 5);
  });
});
