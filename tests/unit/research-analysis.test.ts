// tests/unit/research-analysis.test.ts
import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/research/analysis";
import { preRegister } from "@/lib/research/methodology";
import { fixtureDataset } from "@/tests/support/research-fixtures";

const method = preRegister("What % raise rates?", "rate_raisers", 30, "2026-01-01T00:00:00.000Z");

describe("analyze", () => {
  it("computes a proportion finding with provenance and CI", () => {
    const f = analyze(fixtureDataset(), method); // 62/100
    expect(f.value).toBeCloseTo(62, 5);
    expect(f.n).toBe(100);
    expect(f.source).toBe("OpenSurvey 2026");
    expect(f.method).toBe("proportion");
    expect(f.headlineStat).toMatch(/62%/);
    expect(f.interval.low).toBeGreaterThan(50);
    expect(f.interval.high).toBeLessThan(75);
    // 62/100 → Wilson width ~19pp → honest label is "medium" (high is ≤15pp)
    expect(f.confidence).toBe("medium");
  });
});
