import { describe, expect, it } from "vitest";
import { SeoEngineAuditProvider } from "@/lib/providers/seo-engine";
import { normalizeHtmlToCrawlEvidence } from "@/lib/providers/crawler";

describe("SEO engine provider", () => {
  it("maps deep engine findings into product audit issues", () => {
    const html = "<html><head></head><body><main><h1>Services</h1></main></body></html>";
    const crawl = normalizeHtmlToCrawlEvidence({
      url: "https://example.com",
      finalUrl: "https://example.com/",
      statusCode: 200,
      html,
    });

    const issues = new SeoEngineAuditProvider().auditHtml("https://example.com", html, crawl);

    expect(issues.some((issue) => issue.ruleId === "title-missing")).toBe(true);
    expect(issues.every((issue) => issue.evidenceIds.includes("ev-live-crawl-page"))).toBe(true);
    expect(crawl.rawHtml).toBe(html);
  });
});
