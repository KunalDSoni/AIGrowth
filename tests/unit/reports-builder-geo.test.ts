import { describe, expect, it } from "vitest";
import { assembleSpineFrom } from "@/lib/reports/spine";
import { buildGeoReport } from "@/lib/reports/builders/geo";
import type { AnalyzeResult } from "@/lib/analyze/types";

function analyze(sampleSize: number): AnalyzeResult {
  return {
    project: { id: "p", domain: "acme.com", brandGuess: "Acme", url: "https://acme.com" },
    seo: { site: { score: 0, band: "poor", pagesScanned: 0, pagesFailed: 0, totalIssues: 0, critical: 0, high: 0, quickWins: 0, monitors: 0, worstPages: [], topIssues: [] }, pages: [], siteIssues: [], scannedAt: "", finalUrl: "", origin: "" },
    geo: { runId: "g", model: "gemini", sampleSize, brandMentionRate: 0.4, firstPartyCitationShare: 0.25, observations: [], errors: [], cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 } },
    evidence: [], nextActions: [], guardrails: [], analyzedAt: "2026-07-24T00:00:00Z",
  } as AnalyzeResult;
}

describe("buildGeoReport", () => {
  it("labels rates with sample size when ready", () => {
    const model = buildGeoReport(assembleSpineFrom("acme.com", analyze(20), null));
    expect(model.slug).toBe("geo");
    expect(model.status).toBe("ready");
    const kpis = model.sections.flatMap((s) => s.blocks).find((b) => b.kind === "kpis");
    expect(kpis).toBeDefined();
    if (kpis?.kind === "kpis") {
      const mention = kpis.items.find((i) => i.label.toLowerCase().includes("mention"));
      expect(mention?.value).toContain("40");
      expect(mention?.hint).toContain("20");
    }
  });

  it("flags insufficient sample below the floor", () => {
    const model = buildGeoReport(assembleSpineFrom("acme.com", analyze(3), null));
    expect(model.status).toBe("insufficient");
    const kinds = model.sections.flatMap((s) => s.blocks.map((b) => b.kind));
    expect(kinds).toContain("insufficient");
  });
});
