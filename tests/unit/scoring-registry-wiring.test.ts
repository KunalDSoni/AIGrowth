import { describe, expect, it } from "vitest";
import { bandFor, computeReadiness } from "@/lib/engines/readiness";
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

describe("readiness reads the registry (behaviour preserved)", () => {
  it("subtracts the documented penalties", () => {
    // 1 critical (-15) + 1 high (-6) + 1 quick-win (-3) = 100 - 24 = 76
    expect(computeReadiness([issue("critical", "c"), issue("high", "h"), issue("quick-win", "q")]).score).toBe(76);
  });

  it("bands at the documented cutoffs", () => {
    expect(bandFor(85)).toBe("excellent");
    expect(bandFor(84)).toBe("good");
    expect(bandFor(70)).toBe("good");
    expect(bandFor(69)).toBe("fair");
    expect(bandFor(50)).toBe("fair");
    expect(bandFor(49)).toBe("poor");
    expect(bandFor(0)).toBe("poor");
  });
});
