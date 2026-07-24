import { describe, expect, it } from "vitest";
import { assembleFixDraft, draftFixAsset, scaffoldFromBrief } from "@/lib/engines/geo-fix-draft";
import { transitionApproval, type ContentBrief } from "@/lib/engines/brief-builder";

function brief(overrides: Partial<ContentBrief> = {}): ContentBrief {
  return {
    id: "brief-fix-faq-block",
    recommendationId: "fix-faq-block",
    contentType: "faq",
    objective: "Add an FAQ block: answer buyer questions.",
    audience: "prospective buyers",
    intent: "Be citable for payroll questions",
    evidenceIds: ["ev-1"],
    proofRequirements: ["Questions from real customers", "Accurate current answers"],
    internalLinks: [],
    cta: "Ask us your question",
    measurementPlan: ["Record publish date.", "Compare a 30-90 day window."],
    claimsToVerify: ["Verify: brand absent in AI answers"],
    ...overrides,
  };
}

describe("geo fix draft", () => {
  it("scaffolds the brief's proof requirements and cta as publishable content", () => {
    const body = scaffoldFromBrief(brief());
    expect(body).toContain("Questions from real customers");
    expect(body).toContain("Ask us your question");
  });

  it("keeps process metadata (measurement plan, claims-to-verify) out of the content body", () => {
    // Those live on the brief and belong in the approval UI, not the publishable draft.
    const body = scaffoldFromBrief({
      ...brief(),
      measurementPlan: ["Track leading indicators without guaranteed causation."],
      claimsToVerify: ["Verify: brand absent in AI answers"],
    });
    expect(body).not.toContain("leading indicators");
    expect(body).not.toContain("Verify: brand absent");
  });

  it("produces a gated draft that starts in draft and requires approval", () => {
    const draft = draftFixAsset(brief());
    expect(draft.approvalState).toBe("draft");
    expect(draft.requiresApprovalToPublish).toBe(true);
    expect(draft.version).toBe(1);
  });

  it("scaffold contains no unsupported claims", () => {
    expect(draftFixAsset(brief()).claimFlags).toEqual([]);
  });

  it("flags unsupported claims in a crew/LLM-authored body and blocks approval", () => {
    const draft = assembleFixDraft(brief(), "We are the number one guaranteed payroll provider.");
    expect(draft.claimFlags.length).toBeGreaterThan(0);
    expect(() => transitionApproval(draft, "approved")).toThrow();
  });

  it("a clean scaffold draft can be moved to in-review", () => {
    const draft = draftFixAsset(brief());
    expect(transitionApproval(draft, "in-review").approvalState).toBe("in-review");
  });
});
