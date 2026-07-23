import { describe, expect, it } from "vitest";
import { count, hours, percentFromFraction, percentValue, score, usd } from "@/lib/metrics/construct";

const base = { basis: "measured" as const, evidenceIds: ["ev-1"] };

describe("metric constructors", () => {
  it("percentValue stores an already-0-100 value unchanged", () => {
    const m = percentValue(40, base);
    expect(m).toMatchObject({ value: 40, unit: "percent", basis: "measured", evidenceIds: ["ev-1"] });
  });

  it("percentFromFraction multiplies a 0-1 fraction by 100 exactly once", () => {
    expect(percentFromFraction(0.4, base).value).toBe(40);
  });

  it("clamps a percent to the 0-100 range", () => {
    expect(percentValue(4000, base).value).toBe(100);
    expect(percentValue(-5, base).value).toBe(0);
  });

  it("renders NaN-valued metrics as insufficient", () => {
    const m = count(Number.NaN, base);
    expect(m.confidence).toBe("insufficient");
  });

  it("carries a sample and derives an n>=minReliable gate confidence", () => {
    const low = percentValue(40, { ...base, sample: { n: 3, minReliable: 20 } });
    expect(low.confidence).toBe("insufficient");
    const ok = percentValue(40, { ...base, sample: { n: 25, minReliable: 20 } });
    expect(ok.confidence).toBe("insufficient"); // no interval supplied → insufficient
  });

  it("requires assumptions for an estimated metric", () => {
    expect(() => usd(0.12, { basis: "estimated", evidenceIds: [] })).toThrow(
      "estimated metric requires assumptions",
    );
    expect(usd(0.12, { basis: "estimated", evidenceIds: [], assumptions: ["blended $0.10/1M tokens"] }).value).toBe(0.12);
  });

  it("builds count, score, hours with their units", () => {
    expect(count(19, base).unit).toBe("count");
    expect(score(72, base).unit).toBe("score");
    expect(hours(3, base).unit).toBe("hours");
  });
});
