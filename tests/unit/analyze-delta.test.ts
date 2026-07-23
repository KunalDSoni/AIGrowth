import { describe, it, expect } from "vitest";
import { compareAnalyzeSnapshots, type AnalyzeSnapshot } from "@/lib/engines/analyze-delta";

function snap(partial: Partial<AnalyzeSnapshot> & { analyzedAt: string; seo: AnalyzeSnapshot["seo"]; geo: AnalyzeSnapshot["geo"] }): AnalyzeSnapshot {
  return {
    brandGuess: "DiligenceOS",
    domain: "dosacc.com",
    nextActionIds: ["a", "b"],
    topActionTitles: ["Fix A", "Fix B"],
    ...partial,
  };
}

describe("compareAnalyzeSnapshots", () => {
  it("marks SEO score up and issues down as improvements", () => {
    const baseline = snap({
      analyzedAt: "2026-07-01T00:00:00.000Z",
      seo: { score: 80, band: "good", pagesScanned: 5, totalIssues: 10, critical: 2, high: 3, quickWins: 5 },
      geo: { runId: "g1", model: "m", sampleSize: 6, brandMentionRate: 20, firstPartyCitationShare: 0 },
    });
    const current = snap({
      analyzedAt: "2026-07-23T00:00:00.000Z",
      seo: { score: 92, band: "excellent", pagesScanned: 6, totalIssues: 4, critical: 0, high: 1, quickWins: 3 },
      geo: { runId: "g2", model: "m", sampleSize: 6, brandMentionRate: 50, firstPartyCitationShare: 10 },
      nextActionIds: ["b", "c"],
      topActionTitles: ["Fix B", "Fix C"],
    });

    const delta = compareAnalyzeSnapshots(baseline, current);
    expect(delta.metrics.find((m) => m.key === "seoScore")?.improved).toBe(true);
    expect(delta.metrics.find((m) => m.key === "critical")?.improved).toBe(true);
    expect(delta.metrics.find((m) => m.key === "brandMentionRate")?.delta).toBe(30);
    expect(delta.actionsResolved).toContain("Fix A");
    expect(delta.actionsNew).toContain("Fix C");
    expect(delta.confidence).toBe("Medium");
    expect(delta.attributionLimits.length).toBeGreaterThan(20);
  });
});
