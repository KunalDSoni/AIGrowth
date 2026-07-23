import { describe, expect, it } from "vitest";
import { isSignificantChange, normalCdf, twoProportionPValue } from "@/lib/metrics/significance";

describe("normalCdf", () => {
  it("matches known values", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 3);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });
});

describe("twoProportionPValue", () => {
  it("is ~1 for identical proportions", () => {
    expect(twoProportionPValue(2, 5, 2, 5)).toBeCloseTo(1, 2);
  });
  it("is tiny for a large clear difference", () => {
    expect(twoProportionPValue(2, 50, 20, 50)).toBeLessThan(0.001);
  });
  it("returns 1 when both proportions are 0 (se=0)", () => {
    expect(twoProportionPValue(0, 10, 0, 10)).toBe(1);
  });
});

describe("isSignificantChange", () => {
  it("is false for a small noisy change", () => {
    expect(isSignificantChange(2, 5, 3, 5)).toBe(false); // p ~ 0.53
  });
  it("is true for a large change on a real sample", () => {
    expect(isSignificantChange(3, 30, 18, 30)).toBe(true); // p ~ 5e-5
  });
});
