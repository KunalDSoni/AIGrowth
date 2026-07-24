import { describe, expect, it } from "vitest";
import { shipFix } from "@/lib/engines/geo-fix-ship";
import { makeAnalyzeResult } from "../support/analyze-input";
import type { AnalyzeResult } from "@/lib/analyze/types";
import type { CitationFix } from "@/lib/engines/geo-citation-fix";

function answered(result: AnalyzeResult): AnalyzeResult {
  return {
    ...result,
    geo: {
      ...result.geo,
      observations: result.geo.observations.map((o, i) => ({ ...o, id: `obs-${i}`, rawResponse: "answer" })),
    },
  };
}

function fix(): CitationFix {
  return {
    id: "fix-faq-block",
    fixTypeId: "faq-block",
    feature: "hasFaqStructure",
    title: "Add an FAQ block",
    whatToCreate: "Add a Q&A block.",
    whyItEarnsCitations: "FAQ maps to questions.",
    affectedPrompts: ["obs-0", "obs-1"],
    competitorShare: 0.5,
    effort: "low",
    expectedLiftBand: "moderate",
    priority: 2,
    confidence: "Medium",
    evidenceIds: [],
    assumptions: ["directional"],
  };
}

const NOW = new Date("2026-07-25T09:00:00Z");

describe("shipFix", () => {
  it("approves the fix and records an intervention with a baseline", () => {
    const result = answered(makeAnalyzeResult({ domain: "ship.invalid", geoSampleSize: 4 }));
    const { intervention, asset } = shipFix({ result, fix: fix(), approvedBy: "kunal", now: NOW });
    expect(asset.asset.approvalState).toBe("approved");
    expect(asset.provenance.approvedBy).toBe("kunal");
    expect(intervention.fixId).toBe("fix-faq-block");
    expect(intervention.affectedPrompts).toEqual(["obs-0", "obs-1"]);
    expect(intervention.baseline.answered).toBe(2);
    expect(intervention.shippedAt).toBe("2026-07-25T09:00:00.000Z");
  });

  it("refuses to ship without an approver (human gate)", () => {
    const result = answered(makeAnalyzeResult({ domain: "ship2.invalid", geoSampleSize: 4 }));
    expect(() => shipFix({ result, fix: fix(), approvedBy: "  " })).toThrow(/approver identity/i);
  });
});
