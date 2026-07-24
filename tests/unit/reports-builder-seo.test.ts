import { describe, expect, it } from "vitest";
import { assembleSpineFrom } from "@/lib/reports/spine";
import { buildSeoReport } from "@/lib/reports/builders/seo";
import type { AnalyzeResult } from "@/lib/analyze/types";

function analyze(pages: number): AnalyzeResult {
  return {
    project: { id: "p", domain: "acme.com", brandGuess: "Acme", url: "https://acme.com" },
    seo: {
      site: { score: 72, band: "solid", pagesScanned: pages, pagesFailed: 0, totalIssues: 1, critical: 0, high: 1, quickWins: 0, monitors: 0, worstPages: [], topIssues: [] },
      pages: Array.from({ length: pages }, () => ({})) as never,
      siteIssues: [
        { id: "i1", ruleId: "meta.title.missing", category: "metadata", severity: "high", title: "Missing title tags", description: "3 pages lack titles", recommendedAction: "Add unique titles", affectedPages: 3, evidenceIds: [], impactArea: "metadata" },
      ] as never,
      scannedAt: "2026-07-24T00:00:00Z", finalUrl: "https://acme.com", origin: "https://acme.com",
    },
    geo: { runId: "g", model: "gemini", sampleSize: 20, brandMentionRate: 0, firstPartyCitationShare: 0, observations: [], errors: [], cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 } },
    evidence: [], nextActions: [], guardrails: [], analyzedAt: "2026-07-24T00:00:00Z",
  } as AnalyzeResult;
}

describe("buildSeoReport", () => {
  it("emits KPIs and a ranked issues table when data is ready", () => {
    const model = buildSeoReport(assembleSpineFrom("acme.com", analyze(12), null));
    expect(model.slug).toBe("seo");
    expect(model.status).toBe("ready");
    const kinds = model.sections.flatMap((s) => s.blocks.map((b) => b.kind));
    expect(kinds).toContain("kpis");
    expect(kinds).toContain("table");
  });

  it("emits only an insufficient block when SEO has not run", () => {
    const model = buildSeoReport(assembleSpineFrom("acme.com", null, null));
    expect(model.status).toBe("not_run");
    const kinds = model.sections.flatMap((s) => s.blocks.map((b) => b.kind));
    expect(kinds).toEqual(["insufficient"]);
  });
});
