import { describe, expect, it } from "vitest";
import { count, hours, percentValue, score, usd } from "@/lib/metrics/construct";
import { formatMetric, gateMessage, isReliable } from "@/lib/metrics/format";
import { wilsonInterval } from "@/lib/metrics/wilson";

const base = { basis: "measured" as const, evidenceIds: [] };

describe("formatMetric", () => {
  it("renders a percent without ever multiplying again", () => {
    expect(formatMetric(percentValue(40, base))).toBe("40%");
  });

  it("renders usd, hours, score, count", () => {
    expect(formatMetric(usd(0.12, { basis: "estimated", evidenceIds: [], assumptions: ["x"] }))).toBe("$0.12");
    expect(formatMetric(hours(3, base))).toBe("3h");
    expect(formatMetric(score(72, base))).toBe("72");
    expect(formatMetric(count(19, base))).toBe("19");
  });

  it("renders a non-finite metric as an em dash", () => {
    expect(formatMetric(count(Number.NaN, base))).toBe("—");
  });
});

describe("isReliable and gateMessage", () => {
  it("is unreliable below the minimum sample", () => {
    const m = percentValue(40, { ...base, sample: { n: 3, minReliable: 20 } });
    expect(isReliable(m)).toBe(false);
    expect(gateMessage(m)).toBe("Insufficient sample — n=3, need 20");
  });

  it("is reliable at or above the minimum sample", () => {
    expect(isReliable(percentValue(40, { ...base, sample: { n: 25, minReliable: 20 } }))).toBe(true);
  });

  it("treats a metric with no sample as reliable (not sampled)", () => {
    expect(isReliable(score(72, base))).toBe(true);
  });
});

describe("wilsonInterval stub", () => {
  it("returns null until sub-project 2 implements it", () => {
    expect(wilsonInterval(2, 5)).toBeNull();
  });
});
