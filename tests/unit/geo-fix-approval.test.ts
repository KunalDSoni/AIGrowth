import { describe, expect, it } from "vitest";
import { approveFixAsset } from "@/lib/engines/geo-fix-approval";
import { draftFixAsset } from "@/lib/engines/geo-fix-draft";
import { generateDraft, type ContentBrief } from "@/lib/engines/brief-builder";
import type { CitationFix } from "@/lib/engines/geo-citation-fix";

function brief(): ContentBrief {
  return {
    id: "brief-fix-faq-block",
    recommendationId: "fix-faq-block",
    contentType: "faq",
    objective: "Add an FAQ block.",
    audience: "buyers",
    intent: "Be citable.",
    evidenceIds: ["ev-1"],
    proofRequirements: ["Accurate answers"],
    internalLinks: [],
    cta: "Ask us",
    measurementPlan: ["Record publish date."],
    claimsToVerify: [],
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
    affectedPrompts: ["p1", "p2"],
    competitorShare: 0.5,
    effort: "low",
    expectedLiftBand: "moderate",
    priority: 2,
    confidence: "Medium",
    evidenceIds: ["ev-1"],
    assumptions: ["directional"],
  };
}

const NOW = new Date("2026-07-24T12:00:00Z");

describe("approveFixAsset", () => {
  it("approves a clean draft and records provenance linked to the fix", () => {
    const { asset, provenance } = approveFixAsset({
      asset: draftFixAsset(brief()),
      fix: fix(),
      approvedBy: "kunal",
      now: NOW,
    });
    expect(asset.approvalState).toBe("approved");
    expect(provenance.fixId).toBe("fix-faq-block");
    expect(provenance.feature).toBe("hasFaqStructure");
    expect(provenance.affectedPrompts).toEqual(["p1", "p2"]);
    expect(provenance.evidenceIds).toEqual(["ev-1"]);
    expect(provenance.approvedBy).toBe("kunal");
    expect(provenance.approvedAt).toBe("2026-07-24T12:00:00.000Z");
  });

  it("refuses anonymous approval", () => {
    expect(() =>
      approveFixAsset({ asset: draftFixAsset(brief()), fix: fix(), approvedBy: "  " }),
    ).toThrow(/approver identity/i);
  });

  it("refuses to approve a draft with unresolved claim flags", () => {
    const flagged = generateDraft(brief(), "We are the number one guaranteed provider.");
    expect(() => approveFixAsset({ asset: flagged, fix: fix(), approvedBy: "kunal" })).toThrow();
  });

  it("does not mutate the original draft object", () => {
    const original = draftFixAsset(brief());
    approveFixAsset({ asset: original, fix: fix(), approvedBy: "kunal", now: NOW });
    expect(original.approvalState).toBe("draft");
  });
});
