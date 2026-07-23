import { describe, expect, it } from "vitest";
import { runGeoProbes, type GeoAnswerProvider } from "@/lib/engines/run-geo";
import { geoMentionMetric } from "@/lib/marketing/metrics-view";
import { isReliable } from "@/lib/metrics/format";

function provider(behaviour: (prompt: string, i: number) => string | Error): GeoAnswerProvider {
  let i = 0;
  return {
    model: "fake-model",
    async answer(prompt: string) {
      const out = behaviour(prompt, i++);
      if (out instanceof Error) throw out;
      return { rawText: out, usage: { promptTokens: 10, completionTokens: 20 } };
    },
  };
}

const input = {
  brandGuess: "DiligenceOS",
  domain: "dosacc.com",
  services: ["bookkeeping", "tax preparation", "payroll"],
};

describe("run-geo sampling at scale", () => {
  it("samples the full universe and clears the reliable threshold", async () => {
    const geo = await runGeoProbes({
      ...input,
      provider: provider((_, i) => (i % 2 === 0 ? "DiligenceOS (dosacc.com) is a strong option." : "Consider other firms.")),
    });
    expect(geo.sampleSize).toBeGreaterThanOrEqual(20);
    const metric = geoMentionMetric({ brandMentionRate: geo.brandMentionRate, sampleSize: geo.sampleSize });
    expect(isReliable(metric)).toBe(true);
  });

  it("counts only answered prompts when a third fail (honest partial sample)", async () => {
    const geo = await runGeoProbes({
      ...input,
      provider: provider((_, i) => (i % 3 === 0 ? new Error("Gemini HTTP 429: quota") : "DiligenceOS is listed.")),
    });
    const requested = geo.observations.length;
    const failed = geo.observations.filter((o) => o.error).length;
    expect(geo.sampleSize).toBe(requested - failed);
    expect(geo.errors.length).toBe(failed);
    expect(failed).toBeGreaterThan(0);
  });

  it("gates when every probe fails (quota exhausted)", async () => {
    const geo = await runGeoProbes({
      ...input,
      provider: provider(() => new Error("Gemini HTTP 429: quota")),
    });
    expect(geo.sampleSize).toBe(0);
    expect(geo.brandMentionRate).toBe(0);
    const metric = geoMentionMetric({ brandMentionRate: 0, sampleSize: 0 });
    expect(isReliable(metric)).toBe(false);
  });
});
