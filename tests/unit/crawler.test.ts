import { describe, expect, it, vi } from "vitest";
import { buildTechnicalAuditIssues, crawlEvidenceToTechnicalObservation } from "@/lib/engines/technical-audit";
import {
  assertPublicHost,
  isPrivateAddress,
  normalizeHtmlToCrawlEvidence,
  SafeWebsiteCrawler,
} from "@/lib/providers/crawler";

describe("safe crawler normalization", () => {
  it("extracts SEO and page evidence from HTML", () => {
    const evidence = normalizeHtmlToCrawlEvidence({
      url: "https://example.com",
      finalUrl: "https://example.com/",
      statusCode: 200,
      observedAt: "2026-07-23T00:00:00.000Z",
      html: `<!doctype html>
        <html lang="en-AU"><head>
          <title>Example service page</title>
          <meta name="description" content="A useful service description.">
          <meta name="viewport" content="width=device-width">
          <meta property="og:title" content="Example">
          <meta name="twitter:card" content="summary">
          <link rel="canonical" href="https://example.com/service">
          <script type="application/ld+json">{}</script>
        </head><body>
          <h1>Service heading</h1><h2>Proof</h2>
          <p>This page explains a real service with enough words to be counted. Contact us to book a review.</p>
          <img src="/a.jpg"><img src="/b.jpg" alt="Team photo">
          <a href="/contact">Contact</a><a href="https://external.example">External</a>
        </body></html>`,
    });

    expect(evidence).toMatchObject({
      title: "Example service page",
      description: "A useful service description.",
      canonical: "https://example.com/service",
      language: "en-AU",
      h1Count: 1,
      imageCount: 2,
      imagesMissingAlt: 1,
      internalLinkCount: 1,
      externalLinkCount: 1,
      hasViewport: true,
      hasStructuredData: true,
      hasClearCta: true,
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

describe("SSRF guards", () => {
  it("flags private and metadata addresses", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("10.0.0.8")).toBe(true);
    expect(isPrivateAddress("192.168.1.1")).toBe(true);
    expect(isPrivateAddress("169.254.169.254")).toBe(true);
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
  });

  it("rejects unsafe protocols, ports, and private IPs before DNS", async () => {
    await expect(assertPublicHost(new URL("file:///etc/passwd"))).rejects.toThrow(/HTTP and HTTPS/);
    await expect(assertPublicHost(new URL("https://example.com:8443/"))).rejects.toThrow(/ports 80 and 443/);
    await expect(assertPublicHost(new URL("http://127.0.0.1/"))).rejects.toThrow(/Private network/);
    await expect(assertPublicHost(new URL("http://169.254.169.254/latest/meta-data/"))).rejects.toThrow(/Private network/);
    await expect(assertPublicHost(new URL("http://metadata.google.internal/"))).rejects.toThrow(/metadata/);
  });

  it("rejects hostnames that resolve to private addresses", async () => {
    await expect(
      assertPublicHost(new URL("https://evil.example/"), async () => [{ address: "10.1.2.3" }]),
    ).rejects.toThrow(/Resolved private/);
  });

  it("re-validates each redirect hop", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "https://safe.example/final" } }),
      )
      .mockResolvedValueOnce(
        new Response("<html lang='en'><head><title>Ok</title></head><body><h1>Ok</h1><p>Enough words for a page.</p></body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );

    const crawler = new SafeWebsiteCrawler({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      dnsLookup: async () => [{ address: "93.184.216.34" }],
    });

    const evidence = await crawler.crawl("https://start.example/");
    expect(evidence.finalUrl).toBe("https://safe.example/final");
    expect(evidence.title).toBe("Ok");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("blocks redirects into private networks", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }),
    );

    const crawler = new SafeWebsiteCrawler({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      dnsLookup: async (hostname) => {
        if (hostname === "start.example") return [{ address: "93.184.216.34" }];
        return [{ address: "127.0.0.1" }];
      },
    });

    await expect(crawler.crawl("https://start.example/")).rejects.toThrow(/Private network|Local or metadata/);
  });
});
