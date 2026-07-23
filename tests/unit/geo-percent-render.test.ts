import { describe, expect, it } from "vitest";
import { runDeepMarketingEngine } from "@/lib/marketing/deep-engine";
import { renderPositionReportHtml } from "@/lib/marketing/report-html";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";
import { makeAnalyzeResult } from "@/tests/support/analyze-input";

describe("GEO percentage rendering", () => {
  it("renders a 40% mention rate as 40%, never 4000%", async () => {
    const result = makeAnalyzeResult({ brandMentionRate: 0.4, geoSampleSize: 25, critical: 2, high: 3 });
    expect(result.geo.brandMentionRate).toBe(40); // 0-100 contract, as run-geo emits
    result.intelligence = buildLiveIntelligence(result);

    const deep = await runDeepMarketingEngine(result, { hoursPerWeek: 8, useGemini: false });
    const html = renderPositionReportHtml(deep.report, deep.packs, deep.context.siteFacts);

    expect(html).toContain("40%");
    expect(html).not.toMatch(/[1-9]\d{3,}%/); // no 4000% and friends
    for (const fact of deep.context.siteFacts) {
      expect(fact).not.toMatch(/[1-9]\d{3,}%/);
    }
  });
});
