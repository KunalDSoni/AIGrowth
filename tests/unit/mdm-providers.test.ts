import { describe, it, expect } from "vitest";
import { MockAnswerEngineProvider, getAnswerEngineProvider } from "@/lib/providers/answer-engine";
import { MockSerpProvider, verifyCitation, getSerpProvider } from "@/lib/providers/serp";
import { MockPerformanceProvider, metricsToIssues, getPerformanceProvider } from "@/lib/providers/performance";
import { MockBacklinkProvider, getBacklinkProvider } from "@/lib/providers/backlinks";
import { measureGeo, verifyAnswerCitations } from "@/lib/ingestion/geo-measurement";

describe("AnswerEngineProvider (MDM-002/003)", () => {
  it("mock is labelled simulated and detects brand mentions", async () => {
    const obs = await new MockAnswerEngineProvider().ask("best crm for saas", { brand: "example" });
    expect(obs.measurement).toBe("simulated");
    expect(obs.citations.length).toBeGreaterThan(0);
  });

  it("measureGeo aggregates and stays simulated for the mock", async () => {
    const m = await measureGeo(new MockAnswerEngineProvider(), ["q1", "q2"], { brand: "acme" });
    expect(m.sampleSize).toBe(2);
    expect(m.citationPresenceRate).toBe(1);
    expect(m.measurement).toBe("simulated");
  });

  it("factory defaults to mock", () => {
    expect(getAnswerEngineProvider({}).engines).toEqual(["mock"]);
  });
});

describe("SerpProvider (MDM-005)", () => {
  it("mock is deterministic and verifies citations by host", async () => {
    const serp = new MockSerpProvider();
    const a = await serp.search("keyword one");
    const b = await serp.search("keyword one");
    expect(a.results[0].url).toBe(b.results[0].url);
    const present = verifyCitation(a, a.results[0].url);
    expect(present.present).toBe(true);
    expect(verifyCitation(a, "https://nowhere-xyz.example.net/").present).toBe(false);
  });

  it("verifyAnswerCitations cross-checks against SERP", async () => {
    const obs = await new MockAnswerEngineProvider().ask("q");
    const checks = await verifyAnswerCitations(new MockSerpProvider(), obs);
    expect(checks).toHaveLength(obs.citations.length);
  });

  it("factory defaults to mock", () => {
    expect(getSerpProvider({}).source).toBe("mock");
  });
});

describe("PerformanceProvider (MDM-004)", () => {
  it("normalizes failing metrics into performance issues", () => {
    const issues = metricsToIssues("https://x.com", { performanceScore: 40, lcpMs: 5000, cls: 0.4, inpMs: 500, tbtMs: 400 });
    expect(issues).toHaveLength(4);
    expect(issues.every((i) => i.impactArea === "performance")).toBe(true);
    expect(issues.every((i) => i.severity === "high")).toBe(true);
  });

  it("passing metrics produce no issues", () => {
    expect(metricsToIssues("https://x.com", { performanceScore: 95, lcpMs: 1000, cls: 0.01, inpMs: 50, tbtMs: 20 })).toHaveLength(0);
  });

  it("mock provider + factory default", async () => {
    const r = await new MockPerformanceProvider().audit("https://x.com");
    expect(r.measurement).toBe("simulated");
    expect(getPerformanceProvider({}).source).toBe("mock");
  });
});

describe("BacklinkProvider (MDM-006)", () => {
  it("mock authority is deterministic and labelled estimate", async () => {
    const a = await new MockBacklinkProvider().authority("https://www.example.com/path");
    const b = await new MockBacklinkProvider().authority("example.com");
    expect(a.domain).toBe("example.com");
    expect(a.authorityScore).toBe(b.authorityScore);
    expect(a.measurement).toBe("estimate");
  });

  it("factory defaults to mock", () => {
    expect(getBacklinkProvider({}).source).toBe("mock");
  });
});
