import { describe, expect, it } from "vitest";
import { MIN_RELIABLE, metricConfidence, wilsonInterval } from "@/lib/metrics/wilson";

describe("wilsonInterval", () => {
  it("computes a known interval", () => {
    const i = wilsonInterval(2, 5)!;
    expect(i.method).toBe("wilson");
    expect(i.low).toBeCloseTo(11.8, 0);
    expect(i.high).toBeCloseTo(76.9, 0);
  });

  it("clamps at the boundaries", () => {
    expect(wilsonInterval(0, 10)!.low).toBe(0);
    expect(wilsonInterval(10, 10)!.high).toBe(100);
  });

  it("returns null for n=0 or non-finite input", () => {
    expect(wilsonInterval(0, 0)).toBeNull();
    expect(wilsonInterval(Number.NaN, 5)).toBeNull();
  });
});

describe("metricConfidence", () => {
  const sample = { n: 25, minReliable: 20 };
  it("is insufficient below the minimum sample", () => {
    expect(metricConfidence({ low: 30, high: 50, method: "wilson" }, { n: 3, minReliable: 20 })).toBe("insufficient");
  });
  it("is insufficient with no interval", () => {
    expect(metricConfidence(null, sample)).toBe("insufficient");
  });
  it("maps interval width to confidence", () => {
    expect(metricConfidence({ low: 40, high: 52, method: "wilson" }, sample)).toBe("high"); // 12pp
    expect(metricConfidence({ low: 30, high: 55, method: "wilson" }, sample)).toBe("medium"); // 25pp
    expect(metricConfidence({ low: 10, high: 60, method: "wilson" }, sample)).toBe("low"); // 50pp
  });
});

describe("MIN_RELIABLE", () => {
  it("names the per-metric sample floors", () => {
    expect(MIN_RELIABLE.geoMentionRate).toBe(20);
    expect(MIN_RELIABLE.firstPartyCitationShare).toBe(15);
  });
});
