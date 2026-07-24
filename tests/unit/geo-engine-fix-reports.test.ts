import { describe, expect, it } from "vitest";
import { buildEngineFixReports } from "@/lib/engines/geo-engine-fix-reports";
import type { EngineGeoResult } from "@/lib/engines/geo-multi-engine";
import type { CitedSourceCrawler } from "@/lib/engines/geo-cited-source-features";
import type { GeoObservation, GeoResult } from "@/lib/analyze/types";
import { makeAnalyzeResult } from "../support/analyze-input";

function obs(id: string, competitor?: string): GeoObservation {
  return {
    id,
    prompt: id,
    rawResponse: "answer",
    brandMentioned: false,
    citations: competitor
      ? [{ url: `https://${competitor}/x`, domain: competitor, classification: "other" as const }]
      : [],
  };
}

function geo(observations: GeoObservation[]): GeoResult {
  return {
    runId: "r",
    model: "m",
    sampleSize: observations.filter((o) => o.rawResponse).length,
    brandMentionRate: 0,
    firstPartyCitationShare: 0,
    observations,
    errors: [],
    cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 },
  };
}

const engineResult = (engine: string, g: GeoResult): EngineGeoResult => ({ engine, measurement: "measured", geo: g });

// Competitor page is rich (FAQ + pricing); the brand's own page is bare → a real gap.
const crawler: CitedSourceCrawler = {
  async crawl(url: string) {
    const rich = "<h2>What is it?</h2><p>x</p><h2>How much?</h2><p>$9/mo</p>";
    const bare = "<p>hello</p>";
    return { rawHtml: url.includes("a.com") ? rich : bare, finalUrl: url, statusCode: 200 };
  },
};

describe("buildEngineFixReports", () => {
  it("produces one engine-tagged report per engine that has a gap", async () => {
    const result = makeAnalyzeResult({ domain: "fd.invalid", geoSampleSize: 4 });
    const reports = await buildEngineFixReports(result, [
      engineResult("openai", geo([obs("o1", "a.com"), obs("o2", "a.com")])),
      engineResult("perplexity", geo([obs("p1", "b.com")])),
    ]);
    expect(reports.map((r) => r.engine)).toEqual(["openai", "perplexity"]);
    expect(reports[0].competitorsBeatingYou[0].domain).toBe("a.com");
    expect(reports.every((r) => r.domain === "fd.invalid")).toBe(true);
  });

  it("skips engines with no competitors and engines with no answered sample", async () => {
    const result = makeAnalyzeResult({ domain: "fd2.invalid", geoSampleSize: 4 });
    const reports = await buildEngineFixReports(result, [
      engineResult("openai", geo([obs("o1", "a.com")])), // gap
      engineResult("perplexity", geo([obs("p1")])), // no competitor → skip
      engineResult("broken", geo([])), // no sample → skip
    ]);
    expect(reports.map((r) => r.engine)).toEqual(["openai"]);
  });

  it("passes a crawler through so per-engine fixes are generated", async () => {
    const result = makeAnalyzeResult({ domain: "fd3.invalid", geoSampleSize: 4 });
    const reports = await buildEngineFixReports(
      result,
      [engineResult("openai", geo([obs("o1", "a.com"), obs("o2", "a.com")]))],
      { crawler },
    );
    expect(reports[0].fixesAvailable).toBe(true);
    expect(reports[0].fixes.length).toBeGreaterThan(0);
  });

  it("returns an empty array when no engine has a gap", async () => {
    const result = makeAnalyzeResult({ domain: "fd4.invalid", geoSampleSize: 4 });
    const reports = await buildEngineFixReports(result, [engineResult("openai", geo([obs("o1")]))]);
    expect(reports).toEqual([]);
  });
});
