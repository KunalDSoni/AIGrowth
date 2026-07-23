import { describe, expect, it } from "vitest";
import { computeReadiness } from "@/lib/engines/readiness";
import type { AuditIssue } from "@/lib/domain/types";

function issue(severity: AuditIssue["severity"], id: string): AuditIssue {
  return {
    id,
    ruleId: "r",
    category: "General",
    severity,
    title: id,
    description: "d",
    recommendedAction: "a",
    affectedPages: 1,
    evidenceIds: [],
    impactArea: "discovery",
  };
}

describe("quickWins vs monitors", () => {
  it("does not count monitors as quick wins", () => {
    const m = computeReadiness([issue("quick-win", "q1"), issue("monitor", "m1"), issue("monitor", "m2")]);
    expect(m.quickWins).toBe(1);
    expect(m.monitor).toBe(2);
  });
});
