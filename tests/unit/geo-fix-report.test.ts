import { describe, expect, it } from "vitest";
import { buildGeoFixReport } from "@/lib/engines/geo-fix-report";
import type { CitedSourceCrawler } from "@/lib/engines/geo-cited-source-features";
import { makeAnalyzeResult } from "../support/analyze-input";
import type { AnalyzeResult } from "@/lib/analyze/types";

/** makeAnalyzeResult leaves rawResponse empty (unanswered); give probes real answers. */
function answered(result: AnalyzeResult): AnalyzeResult {
  return {
    ...result,
    geo: {
      ...result.geo,
      observations: result.geo.observations.map((o) => ({ ...o, rawResponse: "An answer." })),
    },
  };
}

function crawler(html: string): CitedSourceCrawler {
  return {
    async crawl(url: string) {
      return { rawHtml: html, finalUrl: url, statusCode: 200 };
    },
  };
}

describe("buildGeoFixReport", () => {
  it("returns offline diagnosis (no fixes) without a crawler", async () => {
    const result = answered(makeAnalyzeResult({ domain: "a.invalid", geoSampleSize: 4, citedDomains: ["rival.example"] }));
    const report = await buildGeoFixReport(result);
    expect(report.domain).toBe("a.invalid");
    expect(report.fixesAvailable).toBe(false);
    expect(report.fixes).toEqual([]);
    expect(report.note).toContain("diagnosis only");
    // diagnosis is populated offline
    expect(report.sampleSize).toBe(4);
    expect(report.competitorsBeatingYou[0].domain).toBe("rival.example");
    expect(report.absentPrompts.length).toBe(4);
  });

  it("produces fixes when a crawler reveals cited-source features the brand lacks", async () => {
    const result = answered(makeAnalyzeResult({ domain: "b.invalid", geoSampleSize: 4, citedDomains: ["rival.example"] }));
    // cited source has an FAQ + pricing; brand page (same crawler) also returns this html,
    // so to create a real gap the brand page must lack them — use a crawler keyed by url.
    const keyed: CitedSourceCrawler = {
      async crawl(url: string) {
        const rich = "<h2>What is it?</h2><p>x</p><h2>How much?</h2><p>$49/mo</p>";
        const bare = "<p>hello</p>";
        return { rawHtml: url.includes("rival.example") ? rich : bare, finalUrl: url, statusCode: 200 };
      },
    };
    const report = await buildGeoFixReport(result, { crawler: keyed });
    expect(report.fixesAvailable).toBe(true);
    expect(report.fixes.length).toBeGreaterThan(0);
    expect(report.fixes.map((f) => f.fixTypeId)).toContain("faq-block");
  });

  it("falls back to diagnosis-only when the brand page cannot be read", async () => {
    const result = answered(makeAnalyzeResult({ domain: "c.invalid", geoSampleSize: 4, citedDomains: ["rival.example"] }));
    const failBrand: CitedSourceCrawler = {
      async crawl(url: string) {
        if (url.includes("c.invalid")) throw new Error("blocked");
        return { rawHtml: "<p>rival</p>", finalUrl: url, statusCode: 200 };
      },
    };
    const report = await buildGeoFixReport(result, { crawler: failBrand });
    expect(report.fixesAvailable).toBe(false);
    expect(report.note).toContain("Could not read your page");
  });

  it("uses the crawler happy path", async () => {
    const result = answered(makeAnalyzeResult({ domain: "d.invalid", geoSampleSize: 4, citedDomains: ["rival.example"] }));
    const report = await buildGeoFixReport(result, { crawler: crawler("<p>same</p>") });
    // brand and rival identical → no gaps → note explains no gaps
    expect(report.fixes).toEqual([]);
    expect(report.fixesAvailable).toBe(true);
  });
});
