import { describe, expect, it } from "vitest";
import { citationFixToBrief } from "@/lib/engines/geo-fix-brief";
import type { CitationFix } from "@/lib/engines/geo-citation-fix";
import type { FixTypeId } from "@/lib/engines/geo-fix-taxonomy";
import type { EvidenceReference } from "@/lib/domain/types";

function fix(overrides: Partial<CitationFix> = {}): CitationFix {
  return {
    id: "fix-faq-block",
    fixTypeId: "faq-block",
    feature: "hasFaqStructure",
    title: "Add an FAQ block",
    whatToCreate: "Add a question-and-answer FAQ block.",
    whyItEarnsCitations: "FAQ blocks map to buyer questions.",
    affectedPrompts: ["Best payroll providers", "How much does payroll cost?"],
    competitorShare: 0.67,
    effort: "low",
    expectedLiftBand: "high",
    priority: 3.2,
    confidence: "Medium",
    evidenceIds: ["ev-1"],
    assumptions: ["Expected-lift band is directional."],
    ...overrides,
  };
}

function evidence(id: string, simulated = false): EvidenceReference {
  return {
    id,
    organizationId: "org",
    projectId: "proj",
    kind: "AI_INFERENCE",
    source: "geo",
    retrievedAt: "2026-07-24T00:00:00Z",
    reliability: "medium" as EvidenceReference["reliability"],
    isEstimated: false,
    isSimulated: simulated,
    summary: "brand absent in AI answers",
  };
}

describe("citationFixToBrief", () => {
  it("maps an FAQ fix to a faq brief with the fix framed as objective/intent", () => {
    const brief = citationFixToBrief(fix(), { evidence: [evidence("ev-1")] });
    expect(brief.contentType).toBe("faq");
    expect(brief.recommendationId).toBe("fix-faq-block");
    expect(brief.objective).toContain("Add an FAQ block");
    expect(brief.intent).toContain("Best payroll providers");
    expect(brief.evidenceIds).toEqual(["ev-1"]);
    expect(brief.proofRequirements.length).toBeGreaterThan(0);
  });

  it("maps a comparison fix to a comparison brief", () => {
    const brief = citationFixToBrief(fix({ fixTypeId: "comparison-page", feature: "hasComparisonContent" }), {
      evidence: [],
    });
    expect(brief.contentType).toBe("comparison");
  });

  it("maps every fix type to a content type without throwing", () => {
    const ids: FixTypeId[] = [
      "direct-answer",
      "faq-block",
      "comparison-page",
      "pricing-page",
      "freshness-refresh",
      "structured-data",
      "proof-block",
    ];
    for (const fixTypeId of ids) {
      const brief = citationFixToBrief(fix({ fixTypeId }), { evidence: [] });
      expect(brief.contentType).toBeTruthy();
    }
  });

  it("carries simulated evidence into claimsToVerify", () => {
    const brief = citationFixToBrief(fix(), { evidence: [evidence("ev-1", true)] });
    expect(brief.claimsToVerify.length).toBeGreaterThan(0);
  });

  it("only includes evidence referenced by the fix", () => {
    const brief = citationFixToBrief(fix({ evidenceIds: ["ev-1"] }), {
      evidence: [evidence("ev-1"), evidence("ev-2")],
    });
    expect(brief.evidenceIds).toEqual(["ev-1"]);
  });

  it("falls back to a feature-based intent when there are no prompts", () => {
    const brief = citationFixToBrief(fix({ affectedPrompts: [] }), { evidence: [] });
    expect(brief.intent).toContain("hasFaqStructure");
  });
});
