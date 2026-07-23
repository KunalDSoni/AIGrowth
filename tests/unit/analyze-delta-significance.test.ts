import { describe, expect, it } from "vitest";
import { compareAnalyzeSnapshots } from "@/lib/engines/analyze-delta";
import type { AnalyzeSnapshot } from "@/lib/engines/analyze-delta";

function snap(rate: number, n: number, at: string): AnalyzeSnapshot {
  return {
    analyzedAt: at,
    brandGuess: "Test Brand",
    domain: "example.invalid",
    seo: { score: 80, band: "good", pagesScanned: 10, totalIssues: 0, critical: 0, high: 0, quickWins: 0 },
    geo: { runId: "r", model: "test-model", sampleSize: n, brandMentionRate: rate, firstPartyCitationShare: 0 },
    nextActionIds: [],
    topActionTitles: [],
  } as AnalyzeSnapshot;
}

function rateMetric(d: ReturnType<typeof compareAnalyzeSnapshots>) {
  return d.metrics.find((m) => m.key === "brandMentionRate")!;
}

describe("analyze-delta significance", () => {
  it("does not call a noisy small change improved", () => {
    const d = compareAnalyzeSnapshots(snap(40, 5, "2026-07-01"), snap(42, 5, "2026-07-15"));
    const m = rateMetric(d);
    expect(m.significant).toBe(false);
    expect(m.improved).toBe(false);
  });

  it("calls a large change on a real sample improved", () => {
    const d = compareAnalyzeSnapshots(snap(10, 30, "2026-07-01"), snap(60, 30, "2026-07-15"));
    const m = rateMetric(d);
    expect(m.significant).toBe(true);
    expect(m.improved).toBe(true);
  });

  it("reports exact-count metrics as always significant", () => {
    const d = compareAnalyzeSnapshots(snap(40, 5, "2026-07-01"), snap(40, 5, "2026-07-15"));
    const seo = d.metrics.find((m) => m.key === "seoScore")!;
    expect(seo.significant).toBe(true);
  });
});
