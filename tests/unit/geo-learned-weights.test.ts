import { describe, expect, it } from "vitest";
import { learnedFixWeights } from "@/lib/engines/geo-fix-bandit";
import { buildGeoFixReport } from "@/lib/engines/geo-fix-report";
import type { CitationLift } from "@/lib/engines/geo-lift";
import type { CitedSourceCrawler } from "@/lib/engines/geo-cited-source-features";
import { makeAnalyzeResult } from "../support/analyze-input";
import type { AnalyzeResult } from "@/lib/analyze/types";

function answered(result: AnalyzeResult): AnalyzeResult {
  return {
    ...result,
    geo: { ...result.geo, observations: result.geo.observations.map((o, i) => ({ ...o, id: `obs-${i}`, rawResponse: "a" })) },
  };
}

function lift(feature: CitationLift["feature"], deltaShare: number, significant: boolean): CitationLift {
  return {
    fixId: `fix-${feature}`,
    feature,
    affectedPrompts: ["p1"],
    baseline: { answered: 4, brandCited: 0, citedShare: 0 },
    post: { answered: 4, brandCited: 3, citedShare: 0.75 },
    deltaShare,
    postInterval: null,
    pValue: significant ? 0.01 : 0.4,
    significant,
    label: significant ? "directional" : "insufficient",
    note: "",
  };
}

// rival page has BOTH a direct-answer lead and a freshness signal; brand has neither.
const keyedCrawler: CitedSourceCrawler = {
  async crawl(url: string) {
    const rich = "<p>Payroll is a managed service.</p><p>Last updated 2026.</p>";
    const bare = "<p>hello</p>";
    return { rawHtml: url.includes("rival.example") ? rich : bare, finalUrl: url, statusCode: 200 };
  },
};

describe("learnedFixWeights", () => {
  it("weights a fix type with winning lifts above one with losing lifts", () => {
    const weights = learnedFixWeights([
      lift("hasFreshnessSignal", 0.5, true),
      lift("hasFreshnessSignal", 0.4, true),
      lift("hasDirectAnswer", 0, false),
      lift("hasDirectAnswer", 0, false),
    ]);
    expect(weights["freshness-refresh"]).toBeGreaterThan(weights["direct-answer"]);
  });

  it("returns the neutral prior for fix types with no measured history", () => {
    expect(learnedFixWeights([])["faq-block"]).toBe(0.5);
  });
});

describe("buildGeoFixReport honors learned weights", () => {
  it("lets a proven fix type outrank a higher static-impact one", async () => {
    const result = answered(makeAnalyzeResult({ domain: "w.invalid", geoSampleSize: 4, citedDomains: ["rival.example"] }));

    const base = await buildGeoFixReport(result, { crawler: keyedCrawler });
    // default: direct-answer (baseImpact 5) outranks freshness (2)
    expect(base.fixes[0].fixTypeId).toBe("direct-answer");

    const weights = learnedFixWeights([
      lift("hasFreshnessSignal", 0.5, true),
      lift("hasFreshnessSignal", 0.5, true),
      lift("hasFreshnessSignal", 0.5, true),
      lift("hasDirectAnswer", 0, false),
      lift("hasDirectAnswer", 0, false),
      lift("hasDirectAnswer", 0, false),
    ]);
    const learned = await buildGeoFixReport(result, { crawler: keyedCrawler, weights });
    expect(learned.fixes[0].fixTypeId).toBe("freshness-refresh");
  });
});
