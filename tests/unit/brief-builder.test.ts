import { describe, expect, it } from "vitest";
import {
  buildBrief,
  diffVersions,
  flagClaims,
  generateDraft,
  transitionApproval,
} from "@/lib/engines/brief-builder";
import type { EvidenceReference } from "@/lib/domain/types";

function evidence(id: string, overrides: Partial<EvidenceReference> = {}): EvidenceReference {
  return {
    id,
    organizationId: "org",
    projectId: "proj",
    kind: "CRAWL_OBSERVATION",
    source: "crawl",
    retrievedAt: "2026-07-23T00:00:00.000Z",
    reliability: "MEDIUM",
    isEstimated: false,
    isSimulated: false,
    summary: `evidence ${id}`,
    ...overrides,
  };
}

describe("buildBrief", () => {
  it("builds a brief from evidence with proof requirements and a CTA", () => {
    const brief = buildBrief({
      recommendationId: "rec-1",
      contentType: "service",
      objective: "Win clinic bookkeeping leads",
      audience: "Practice managers",
      intent: "Commercial",
      evidence: [evidence("ev-1")],
    });
    expect(brief.evidenceIds).toContain("ev-1");
    expect(brief.proofRequirements.length).toBeGreaterThan(0);
    expect(brief.cta).toBe("Book a consultation");
    expect(brief.measurementPlan.length).toBe(3);
  });

  it("turns estimated/simulated evidence into claims to verify", () => {
    const brief = buildBrief({
      recommendationId: "rec-2",
      contentType: "comparison",
      objective: "x",
      audience: "y",
      intent: "Comparison",
      evidence: [evidence("ev-real"), evidence("ev-est", { isEstimated: true, summary: "~700 monthly searches" })],
    });
    expect(brief.claimsToVerify.some((c) => c.includes("700 monthly searches"))).toBe(true);
    expect(brief.claimsToVerify.length).toBe(1);
  });
});

describe("flagClaims", () => {
  it("flags guarantees, superlatives and unsourced stats", () => {
    const flags = flagClaims("We guarantee results. We are the #1 accountant. Clients see 40% growth.");
    expect(flags.length).toBeGreaterThanOrEqual(3);
  });

  it("leaves a factual sentence unflagged", () => {
    expect(flagClaims("We offer bookkeeping and payroll for clinics.")).toEqual([]);
  });
});

describe("draft lifecycle", () => {
  const brief = buildBrief({
    recommendationId: "rec-3",
    contentType: "service",
    objective: "x",
    audience: "y",
    intent: "Commercial",
    evidence: [evidence("ev-1")],
  });

  it("a fresh draft starts in draft state and requires approval to publish", () => {
    const draft = generateDraft(brief, "We offer clinic bookkeeping.");
    expect(draft.approvalState).toBe("draft");
    expect(draft.requiresApprovalToPublish).toBe(true);
  });

  it("cannot approve a draft with unresolved claim flags", () => {
    const draft = generateDraft(brief, "We guarantee more leads.");
    expect(() => transitionApproval(draft, "approved")).toThrow(/claim flag/i);
  });

  it("can approve a clean draft", () => {
    const draft = generateDraft(brief, "We provide clinic bookkeeping and payroll.");
    expect(transitionApproval(draft, "approved").approvalState).toBe("approved");
  });
});

describe("diffVersions", () => {
  it("reports added and removed lines between versions", () => {
    const brief = buildBrief({ recommendationId: "r", contentType: "article", objective: "x", audience: "y", intent: "i", evidence: [evidence("ev-1")] });
    const v1 = generateDraft(brief, "line a\nline b", 1);
    const v2 = generateDraft(brief, "line a\nline c", 2);
    const diff = diffVersions(v1, v2);
    expect(diff.added).toContain("line c");
    expect(diff.removed).toContain("line b");
  });
});
