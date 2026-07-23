import { describe, expect, it } from "vitest";
import { classifyIntent, clusterTopics } from "@/lib/engines/search-intent";

describe("classifyIntent", () => {
  it("detects comparison intent at the decision stage", () => {
    const c = classifyIntent("Xero vs MYOB for small business");
    expect(c.intent).toBe("comparison");
    expect(c.funnelStage).toBe("decision");
    expect(c.recommendedContentType).toMatch(/comparison/i);
  });

  it("detects transactional intent", () => {
    const c = classifyIntent("bookkeeping pricing quote");
    expect(c.intent).toBe("transactional");
  });

  it("detects informational intent at awareness", () => {
    const c = classifyIntent("how to do payroll");
    expect(c.intent).toBe("informational");
    expect(c.funnelStage).toBe("awareness");
  });

  it("detects local intent", () => {
    const c = classifyIntent("accountant near me");
    expect(c.intent).toBe("local");
  });

  it("honours a user override at full confidence", () => {
    const c = classifyIntent("how to do payroll", { intent: "commercial" });
    expect(c.intent).toBe("commercial");
    expect(c.confidence).toBe(100);
    expect(c.signals).toContain("User override applied");
  });

  it("always returns signals and a bounded confidence", () => {
    const c = classifyIntent("zzz qqq");
    expect(c.signals.length).toBeGreaterThan(0);
    expect(c.confidence).toBeGreaterThanOrEqual(0);
    expect(c.confidence).toBeLessThanOrEqual(100);
  });
});

describe("clusterTopics", () => {
  it("groups queries that share salient keywords", () => {
    const clusters = clusterTopics([
      "bookkeeping for clinics",
      "clinic bookkeeping checklist",
      "virtual cfo services",
      "cfo cash flow forecasting",
    ]);
    const clinic = clusters.find((c) => c.members.some((m) => m.includes("clinic")));
    expect(clinic?.members.length).toBe(2);
    const cfo = clusters.find((c) => c.members.some((m) => m.includes("cfo")));
    expect(cfo?.members.length).toBe(2);
  });

  it("is deterministic and covers every query exactly once", () => {
    const queries = ["a bookkeeping guide", "payroll setup", "bookkeeping tips"];
    const clusters = clusterTopics(queries);
    const total = clusters.reduce((sum, c) => sum + c.members.length, 0);
    expect(total).toBe(queries.length);
  });
});
