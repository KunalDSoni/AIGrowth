import { describe, expect, it } from "vitest";
import { computeGeoVariability } from "@/lib/engines/geo-metrics";
import type { GeoResult } from "@/lib/analyze/types";

function geo(mentions: number, n: number): GeoResult {
  return {
    runId: "r",
    model: "test-model",
    sampleSize: n,
    brandMentionRate: Math.round((mentions / n) * 100),
    firstPartyCitationShare: 0,
    observations: Array.from({ length: n }, (_, i) => ({
      id: `o${i}`,
      prompt: "p",
      rawResponse: "",
      brandMentioned: i < mentions,
      citations: [],
    })),
    errors: [],
    cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 },
  };
}

describe("geo-metrics confidence", () => {
  it("is Low for a tiny sample regardless of point value", () => {
    expect(computeGeoVariability(geo(2, 5)).confidence).toBe("Low");
  });

  it("rises only when the interval is tight enough on a real sample", () => {
    const wide = computeGeoVariability(geo(20, 40)); // p=0.5, still fairly wide
    const tight = computeGeoVariability(geo(2, 200)); // p=0.01, narrow
    expect(["Low", "Medium"]).toContain(wide.confidence);
    expect(["Medium", "High"]).toContain(tight.confidence);
  });

  it("labels carry the interval", () => {
    const m = computeGeoVariability(geo(16, 40));
    expect(m.labels.join(" ")).toMatch(/CI/);
  });
});
