import { describe, expect, it } from "vitest";
import { computeReadiness } from "@/lib/engines/readiness";
import type { AuditIssue, Severity } from "@/lib/domain/types";

function issue(severity: Severity, id = severity): AuditIssue {
  return {
    id: `i-${id}-${Math.random()}`,
    ruleId: "metadata-title",
    category: "metadata",
    severity,
    title: "t",
    description: "d",
    recommendedAction: "a",
    affectedPages: 1,
    evidenceIds: [],
    impactArea: "metadata",
  };
}

describe("computeReadiness", () => {
  it("returns a perfect score with no issues", () => {
    const m = computeReadiness([]);
    expect(m.score).toBe(100);
    expect(m.band).toBe("excellent");
    expect(m.total).toBe(0);
  });

  it("subtracts severity-weighted penalties", () => {
    const m = computeReadiness([issue("critical"), issue("high"), issue("monitor")]);
    expect(m.score).toBe(100 - 15 - 6 - 1);
    expect(m.critical).toBe(1);
    expect(m.high).toBe(1);
    expect(m.monitor).toBe(1);
  });

  it("never drops below zero and bands correctly", () => {
    const m = computeReadiness(Array.from({ length: 20 }, () => issue("critical")));
    expect(m.score).toBe(0);
    expect(m.band).toBe("poor");
    expect(m.total).toBe(20);
  });

  it("does not count monitors as quick wins", () => {
    const m = computeReadiness([issue("monitor"), issue("monitor"), issue("quick-win")]);
    expect(m.quickWins).toBe(1);
    expect(m.monitor).toBe(2);
  });
});
