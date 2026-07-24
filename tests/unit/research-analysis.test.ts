import { describe, expect, it } from "vitest";
import {
  analyzeProportion,
  analyzeSegmentComparison,
  ANALYSIS_VERSION,
  type ResearchObservation,
} from "@/lib/engines/research-analysis";

// Build n observations, `hits` of which exhibit the trait, spread over sources.
function makeObs(n: number, hits: number, segment?: string, sourcePrefix = "src"): ResearchObservation[] {
  return Array.from({ length: n }, (_, i) => ({
    source: `${sourcePrefix}-${i % 5}`,
    segment,
    hit: i < hits,
  }));
}

describe("research analysis engine", () => {
  it("exposes a version", () => {
    expect(ANALYSIS_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("recovers a known proportion with a confidence interval", () => {
    // 60 of 100 exhibit the trait → 60%.
    const f = analyzeProportion(makeObs(100, 60), {
      trait: "raised rates in 2026",
      method: "public rate-card synthesis",
      methodologyStrength: "supported",
    });
    expect(f.value).toBe(60);
    expect(f.interval.low).toBeLessThan(60);
    expect(f.interval.high).toBeGreaterThan(60);
    expect(f.interval.method).toBe("wilson");
  });

  it("carries n, sources and method on every finding", () => {
    const f = analyzeProportion(makeObs(50, 25), {
      trait: "use AI tools",
      method: "aggregated survey responses",
      methodologyStrength: "supported",
    });
    expect(f.n).toBe(50);
    expect(f.sources.length).toBeGreaterThan(0);
    expect(f.method).toBe("aggregated survey responses");
  });

  it("never exceeds the methodology strength granted to the study", () => {
    // Statistics would allow supported, but the study was only directional.
    const f = analyzeProportion(makeObs(200, 120), {
      trait: "raised rates",
      method: "m",
      methodologyStrength: "directional",
    });
    expect(f.strength).toBe("directional");
  });

  it("caps a mid-precision proportion at directional even when methodology is supported", () => {
    // n=40 → Wilson width ~30pp: past the precise bar but within directional range.
    const f = analyzeProportion(makeObs(40, 20), {
      trait: "raised rates",
      method: "m",
      methodologyStrength: "supported",
    });
    expect(f.strength).toBe("directional");
    const width = f.interval.high - f.interval.low;
    expect(width).toBeGreaterThan(20);
    expect(width).toBeLessThan(40);
  });

  it("marks a finding insufficient below the minimum per-finding n", () => {
    const f = analyzeProportion(makeObs(3, 2), {
      trait: "raised rates",
      method: "m",
      methodologyStrength: "supported",
    });
    expect(f.strength).toBe("insufficient");
  });

  it("finds a significant segment difference and reports the delta", () => {
    // Segment A: 80/100 hit; Segment B: 30/100 hit → large, significant gap.
    const obs = [...makeObs(100, 80, "senior"), ...makeObs(100, 30, "junior")];
    const f = analyzeSegmentComparison(obs, {
      trait: "raised rates",
      segmentA: "senior",
      segmentB: "junior",
      method: "public rate-card synthesis",
      methodologyStrength: "supported",
    });
    expect(f.value).toBeCloseTo(50, 0);
    expect(f.significant).toBe(true);
    expect(f.strength).toBe("supported");
    expect(f.pValue).toBeLessThan(0.05);
  });

  it("caps a non-significant comparison at directional and marks it not significant", () => {
    // Segment A: 52/100; Segment B: 48/100 → tiny gap, not significant.
    const obs = [...makeObs(100, 52, "a"), ...makeObs(100, 48, "b")];
    const f = analyzeSegmentComparison(obs, {
      trait: "raised rates",
      segmentA: "a",
      segmentB: "b",
      method: "m",
      methodologyStrength: "supported",
    });
    expect(f.significant).toBe(false);
    expect(f.strength).toBe("directional");
    expect(f.pValue).toBeGreaterThanOrEqual(0.05);
  });

  it("handles an empty dataset without throwing, as insufficient", () => {
    const f = analyzeProportion([], {
      trait: "x",
      method: "m",
      methodologyStrength: "supported",
    });
    expect(f.n).toBe(0);
    expect(f.strength).toBe("insufficient");
  });
});
