import { describe, expect, it, vi } from "vitest";
import { compareWithOurSeo, crawlCompetitorHomepage } from "@/lib/engines/competitor-crawl";
import type { SeoResult } from "@/lib/analyze/types";

function seo(partial: Partial<SeoResult["site"]> & { pages?: SeoResult["pages"] } = {}): SeoResult {
  const { pages, ...siteOverrides } = partial;
  return {
    site: {
      score: 72,
      band: "good",
      pagesScanned: 3,
      pagesFailed: 0,
      totalIssues: 4,
      critical: 1,
      high: 2,
      quickWins: 1,
      monitors: 0,
      worstPages: [],
      topIssues: [],
      ...siteOverrides,
    },
    pages: pages ?? [
      {
        url: "https://ours.example/",
        finalUrl: "https://ours.example/",
        title: "Ours",
        ok: true,
        metrics: { score: 72, band: "good", total: 1, critical: 0, high: 1, monitor: 0, quickWins: 0 },
        issues: [],
        observation: {
          id: "obs-home",
          url: "https://ours.example/",
          statusCode: 200,
          title: "Ours",
          description: "desc",
          h1Count: 1,
          wordCount: 400,
          hasViewport: true,
          hasStructuredData: false,
          imageCount: 1,
          imagesMissingAlt: 0,
          internalLinkCount: 5,
          pageType: "home",
          hasClearCta: false,
          hasProofSignal: false,
        },
      },
    ],
    siteIssues: [],
    scannedAt: "2026-07-23T00:00:00.000Z",
    finalUrl: "https://ours.example/",
    origin: "https://ours.example",
  };
}

describe("crawlCompetitorHomepage", () => {
  it("crawls HTML and returns readiness metrics", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        `<!doctype html><html lang="en"><head>
          <title>Rival Bookkeeping</title>
          <meta name="viewport" content="width=device-width">
          <script type="application/ld+json">{}</script>
        </head><body>
          <h1>Bookkeeping for clinics</h1>
          <p>Trusted by clinics. Book a consultation today to get started with monthly reporting.</p>
          <a href="/contact">Contact</a>
        </body></html>`,
        { status: 200, headers: { "content-type": "text/html" } },
      ),
    );

    const result = await crawlCompetitorHomepage("https://rival.example/", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      dnsLookup: async () => [{ address: "93.184.216.34" }],
    });

    expect(result.domain).toBe("rival.example");
    expect(result.title).toBe("Rival Bookkeeping");
    expect(result.hasStructuredData).toBe(true);
    expect(result.hasClearCta).toBe(true);
    expect(result.hasProofSignal).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("rejects private competitor targets", async () => {
    await expect(crawlCompetitorHomepage("http://127.0.0.1/")).rejects.toThrow();
  });
});

describe("compareWithOurSeo", () => {
  it("surfaces proof/CTA/schema gaps against our snapshot", () => {
    const comparison = compareWithOurSeo(
      seo({ score: 60, critical: 2, high: 3 }),
      {
        domain: "rival.example",
        url: "https://rival.example/",
        finalUrl: "https://rival.example/",
        title: "Rival",
        score: 80,
        band: "good",
        issueCount: 1,
        critical: 0,
        high: 1,
        wordCount: 500,
        hasStructuredData: true,
        hasClearCta: true,
        hasProofSignal: true,
        crawledAt: "2026-07-23T00:00:00.000Z",
      },
      "ours.example",
    );

    expect(comparison.deltas.score).toBe(-20);
    expect(comparison.conclusions.some((c) => c.includes("leads your readiness"))).toBe(true);
    expect(comparison.conclusions.some((c) => /proof signals/i.test(c))).toBe(true);
    expect(comparison.conclusions.some((c) => /CTA/i.test(c))).toBe(true);
    expect(comparison.conclusions.some((c) => /structured data/i.test(c))).toBe(true);
  });
});
