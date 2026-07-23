import { describe, expect, it } from "vitest";
import { runDeepMarketingEngine } from "@/lib/marketing/deep-engine";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";
import { makeAnalyzeResult } from "@/tests/support/analyze-input";

describe("channel mix", () => {
  it("allocates hours that sum to the weekly capacity", async () => {
    const result = makeAnalyzeResult({ critical: 2, high: 3, citedDomains: ["directory.invalid"] });
    result.intelligence = buildLiveIntelligence(result);
    const deep = await runDeepMarketingEngine(result, { hoursPerWeek: 8, useGemini: false });

    const totalHours = deep.channelMix.reduce((sum, c) => sum + c.hours, 0);
    expect(totalHours).toBeGreaterThan(7.4);
    expect(totalHours).toBeLessThan(8.6); // sums to capacity within rounding
    for (const c of deep.channelMix) {
      expect(c.hours).toBeGreaterThan(0);
      expect(c.pct).toBeGreaterThan(0);
      expect(c.pct).toBeLessThanOrEqual(1);
    }
  });
});
