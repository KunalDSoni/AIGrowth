// tests/unit/causal-outcomes.test.ts
import { describe, expect, it } from "vitest";
import { mean, splitAround } from "@/lib/causal/outcomes";
import type { OutcomeSeries } from "@/lib/causal/types";

const series: OutcomeSeries = {
  unit: "conversions",
  points: [
    { period: "2026-01-01T00:00:00.000Z", value: 10 },
    { period: "2026-01-02T00:00:00.000Z", value: 20 },
    { period: "2026-01-03T00:00:00.000Z", value: 30 },
    { period: "2026-01-04T00:00:00.000Z", value: 40 },
  ],
};

describe("splitAround", () => {
  it("splits strictly before/after the intervention start", () => {
    const { pre, post } = splitAround(series, "2026-01-03T00:00:00.000Z");
    expect(pre.map((p) => p.value)).toEqual([10, 20]);
    expect(post.map((p) => p.value)).toEqual([30, 40]);
  });
});

describe("mean", () => {
  it("averages values", () => {
    expect(mean(series.points)).toBe(25);
  });
  it("returns NaN for empty input", () => {
    expect(Number.isNaN(mean([]))).toBe(true);
  });
});
