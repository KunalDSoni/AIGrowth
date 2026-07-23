import { describe, expect, it } from "vitest";
import { buildTechnicalAuditIssues, crawlEvidenceToTechnicalObservation } from "@/lib/engines/technical-audit";
import { normalizeHtmlToCrawlEvidence } from "@/lib/providers/crawler";

describe("safe crawler normalization", () => {
  it("extracts SEO and page evidence from HTML", () => {
    const evidence = normalizeHtmlToCrawlEvidence({
      url: "https://example.com",
      finalUrl: "https://example.com/",
      statusCode: 200,
      observedAt: "2026-07-23T00:00:00.000Z",
      html: `<!doctype html>
        <html><head>
          <title>Example service page</title>
          <meta name="description" content="A useful service description.">
          <meta name="viewport" content="width=device-width">
          <meta property="og:title" content="Example">
          <meta name="twitter:card" content="summary">
          <link rel="canonical" href="https://example.com/service">
          <script type="application/ld+json">{}</script>
        </head><body>
          <h1>Service heading</h1><h2>Proof</h2>
          <p>This page explains a real service with enough words to be counted.</p>
          <img src="/a.jpg"><img src="/b.jpg" alt="Team photo">
          <a href="/contact">Contact</a><a href="https://external.example">External</a>
        </body></html>`,
    });

    expect(evidence).toMatchObject({
      title: "Example service page",
      description: "A useful service description.",
      canonical: "https://example.com/service",
      h1Count: 1,
      imageCount: 2,
      imagesMissingAlt: 1,
      internalLinkCount: 1,
      externalLinkCount: 1,
      hasViewport: true,
      hasStructuredData: true,
      openGraphTags: 1,
      twitterTags: 1,
      source: "safe-crawler",
    });
    expect(evidence.headings.map((heading) => heading.text)).toEqual(["Service heading", "Proof"]);
    expect(evidence.wordCount).toBeGreaterThan(8);
  });

  it("feeds normalized crawl evidence into technical rules", () => {
    const crawl = normalizeHtmlToCrawlEvidence({
      url: "https://example.com",
      finalUrl: "https://example.com/",
      statusCode: 200,
      html: "<html><head><title>Home</title><meta name='viewport' content='width=device-width'></head><body><h1>Home</h1><img src='/a.jpg'><a href='/service'>Service</a></body></html>",
    });
    const observation = crawlEvidenceToTechnicalObservation(crawl);
    const issues = buildTechnicalAuditIssues({
      pages: [observation],
      evidenceIds: { metadata: "ev", schema: "ev", links: "ev", alt: "ev", performance: "ev" },
    });

    expect(observation).toMatchObject({ pageType: "home", h1Count: 1, imagesMissingAlt: 1 });
    expect(issues.map((issue) => issue.id)).toEqual(["schema", "links", "alt", "speed"]);
    expect(issues.every((issue) => issue.evidenceIds.includes("ev"))).toBe(true);
  });
});
