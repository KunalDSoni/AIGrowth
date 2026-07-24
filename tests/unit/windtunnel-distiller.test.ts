// tests/unit/windtunnel-distiller.test.ts
import { describe, expect, it } from "vitest";
import { MIN_EVIDENCE_PER_PERSONA, createHeuristicDistiller } from "@/lib/windtunnel/distiller";
import type { EvidenceItem } from "@/lib/windtunnel/types";

const evidence: EvidenceItem[] = [
  { id: "e1", source: "review", segment: "smb", text: "Setup was too slow and confusing", sentiment: "negative" },
  { id: "e2", source: "call_note", segment: "smb", text: "Loved the fast onboarding once configured", sentiment: "positive" },
  { id: "e3", source: "ticket", segment: "enterprise", text: "Needs SSO and audit logs", sentiment: "negative" },
];

describe("createHeuristicDistiller", () => {
  it("builds one persona per adequately-evidenced segment, with quote provenance", () => {
    const personas = createHeuristicDistiller().distill(evidence);
    const smb = personas.find((p) => p.segment === "smb");
    expect(smb).toBeDefined();
    expect(smb!.quoteIds).toEqual(["e1", "e2"]);
    expect(smb!.objections).toContain("Setup was too slow and confusing");
    expect(smb!.jobsToBeDone).toContain("Loved the fast onboarding once configured");
    expect(smb!.vocabulary).toContain("onboarding");
  });

  it("drops segments below the minimum evidence threshold", () => {
    const personas = createHeuristicDistiller().distill(evidence);
    expect(personas.find((p) => p.segment === "enterprise")).toBeUndefined();
    expect(MIN_EVIDENCE_PER_PERSONA).toBe(2);
  });

  it("returns no personas for empty evidence", () => {
    expect(createHeuristicDistiller().distill([])).toEqual([]);
  });
});
