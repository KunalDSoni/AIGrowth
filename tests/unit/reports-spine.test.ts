import { describe, expect, it } from "vitest";
import type { AnalyzeResult } from "@/lib/analyze/types";
import type { MarketingWorkspace } from "@/lib/marketing/workspace";
import {
  assembleSpineFrom,
  statusForGeo,
  statusForMarketing,
  statusForSeo,
} from "@/lib/reports/spine";

function analyzeFixture(over: Partial<AnalyzeResult> = {}): AnalyzeResult {
  return {
    project: { id: "p1", domain: "acme.com", brandGuess: "Acme", url: "https://acme.com" },
    seo: {
      site: { score: 72, band: "solid", pagesScanned: 12, pagesFailed: 0, totalIssues: 5, critical: 1, high: 2, quickWins: 3, monitors: 0, worstPages: [], topIssues: [] },
      pages: [{}, {}] as never,
      siteIssues: [],
      scannedAt: "2026-07-24T00:00:00Z",
      finalUrl: "https://acme.com",
      origin: "https://acme.com",
    },
    geo: { runId: "g1", model: "gemini", sampleSize: 20, brandMentionRate: 0.4, firstPartyCitationShare: 0.2, observations: [], errors: [], cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 } },
    evidence: [],
    nextActions: [],
    guardrails: [],
    analyzedAt: "2026-07-24T00:00:00Z",
    ...over,
  } as AnalyzeResult;
}

function wsFixture(): MarketingWorkspace {
  return {
    domain: "acme.com",
    brand: "Acme",
    source: "live",
    updatedAt: "2026-07-24T00:00:00Z",
    report: { id: "r1", brand: "Acme", domain: "acme.com", generatedAt: "2026-07-24T00:00:00Z", mode: "client", scoreboard: { seoReadiness: 72, geoMentionRate: 0.4, geoSampleSize: 20, competitorPressure: "medium", labels: [] }, chapters: [], improvisation: [], tactics: [], kpis: [] },
  } as unknown as MarketingWorkspace;
}

describe("spine status", () => {
  it("marks SEO ready when pages exist", () => {
    expect(statusForSeo(analyzeFixture())).toBe("ready");
  });
  it("marks SEO not_run when no analyze", () => {
    expect(statusForSeo(null)).toBe("not_run");
  });
  it("marks GEO insufficient below the sample floor", () => {
    expect(statusForGeo(analyzeFixture({ geo: { ...analyzeFixture().geo, sampleSize: 3 } }))).toBe("insufficient");
  });
  it("marks Marketing not_run without a workspace", () => {
    expect(statusForMarketing(null)).toBe("not_run");
  });
});

describe("assembleSpineFrom", () => {
  it("normalizes domain and carries per-section status + data", () => {
    const spine = assembleSpineFrom("https://www.Acme.com/", analyzeFixture(), wsFixture());
    expect(spine.domain).toBe("acme.com");
    expect(spine.brand).toBe("Acme");
    expect(spine.seo.status).toBe("ready");
    expect(spine.geo.status).toBe("ready");
    expect(spine.marketing.status).toBe("ready");
    expect(spine.seo.data).not.toBeNull();
  });
  it("is fully empty when nothing has been run", () => {
    const spine = assembleSpineFrom("acme.com", null, null);
    expect(spine.seo.status).toBe("not_run");
    expect(spine.geo.status).toBe("not_run");
    expect(spine.marketing.status).toBe("not_run");
    expect(spine.marketing.data).toBeNull();
  });
});
