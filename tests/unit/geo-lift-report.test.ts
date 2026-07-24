import { describe, expect, it } from "vitest";
import { buildLiftReport } from "@/lib/engines/geo-lift-report";
import type { CitationLift, LiftLabel } from "@/lib/engines/geo-lift";

function lift(label: LiftLabel, fixId: string): CitationLift {
  return {
    fixId,
    feature: "hasFaqStructure",
    affectedPrompts: ["p1"],
    baseline: { answered: 4, brandCited: 0, citedShare: 0 },
    post: { answered: 4, brandCited: label === "insufficient" ? 1 : 3, citedShare: label === "insufficient" ? 0.25 : 0.75 },
    deltaShare: label === "insufficient" ? 0.25 : 0.75,
    postInterval: { low: 30, high: 95, method: "wilson" },
    pValue: 0.01,
    significant: label !== "insufficient",
    label,
    note: `${label} note`,
  };
}

describe("buildLiftReport", () => {
  it("summarizes labels and only counts causal as proven lifts", () => {
    const report = buildLiftReport([lift("causal", "f1"), lift("directional", "f2"), lift("insufficient", "f3")]);
    expect(report.summary).toEqual({ total: 3, causal: 1, directional: 1, insufficient: 1, provenLifts: 1 });
  });

  it("carries before/after and interval per row", () => {
    const report = buildLiftReport([lift("causal", "f1")]);
    expect(report.rows[0]).toMatchObject({
      fixId: "f1",
      baselineShare: 0,
      postShare: 0.75,
      deltaShare: 0.75,
    });
    expect(report.rows[0].postInterval).not.toBeNull();
  });

  it("writes an honest headline", () => {
    expect(buildLiftReport([lift("causal", "f1")]).headline).toContain("1 of 1");
  });

  it("handles an empty set", () => {
    const report = buildLiftReport([]);
    expect(report.summary.total).toBe(0);
    expect(report.headline).toContain("No shipped fixes");
  });
});
