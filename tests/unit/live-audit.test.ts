import { describe, expect, it } from "vitest";
import { auditCrawledPage } from "@/lib/engines/live-audit";
import type { CrawledPageEvidence } from "@/lib/domain/types";

function page(overrides: Partial<CrawledPageEvidence> = {}): CrawledPageEvidence {
  return {
    url: "https://example.com/",
    finalUrl: "https://example.com/",
    statusCode: 200,
    title: "A perfectly reasonable page title about our services",
    description: "A meta description that is comfortably within the recommended range for search snippets and previews.",
    canonical: "https://example.com/",
    h1Count: 1,
    headings: [{ level: 1, text: "Home" }],
    imageCount: 2,
    imagesMissingAlt: 0,
    internalLinkCount: 10,
    externalLinkCount: 2,
    wordCount: 800,
    hasViewport: true,
    hasStructuredData: true,
    openGraphTags: 4,
    twitterTags: 2,
    observedAt: new Date().toISOString(),
    source: "safe-crawler",
    ...overrides,
  };
}

const ids = (issues: ReturnType<typeof auditCrawledPage>) => issues.map((i) => i.ruleId);

describe("auditCrawledPage", () => {
  it("returns no findings for a healthy page", () => {
    expect(auditCrawledPage(page(), { robotsTxt: "User-agent: *", sitemapFound: true })).toHaveLength(0);
  });

  it("does NOT report broken internal links or path-based canonical mismatch", () => {
    const found = ids(auditCrawledPage(page()));
    expect(found).not.toContain("link-broken-internal");
    expect(found).not.toContain("canonical-mismatch");
    expect(found).not.toContain("og-url-mismatch");
  });

  it("flags a missing title as critical", () => {
    const issues = auditCrawledPage(page({ title: undefined }));
    const titleIssue = issues.find((i) => i.ruleId === "title-missing");
    expect(titleIssue?.severity).toBe("critical");
  });

  it("flags noindex as critical", () => {
    const issues = auditCrawledPage(page({ robotsDirectives: "noindex, nofollow" }));
    expect(ids(issues)).toContain("robots-noindex");
  });

  it("flags missing description, h1, viewport and thin content", () => {
    const found = ids(auditCrawledPage(page({ description: undefined, h1Count: 0, hasViewport: false, wordCount: 120 })));
    expect(found).toEqual(expect.arrayContaining(["meta-description-missing", "h1-missing", "viewport-missing", "thin-content"]));
  });

  it("reports missing robots.txt and sitemap only when context says so", () => {
    expect(ids(auditCrawledPage(page()))).not.toContain("robots-txt-missing");
    const withCtx = ids(auditCrawledPage(page(), { robotsTxt: null, sitemapFound: false }));
    expect(withCtx).toEqual(expect.arrayContaining(["robots-txt-missing", "sitemap-missing"]));
  });

  it("treats missing alt text as a quick win", () => {
    const issues = auditCrawledPage(page({ imagesMissingAlt: 3 }));
    expect(issues.find((i) => i.ruleId === "image-alt-missing")?.severity).toBe("quick-win");
  });
});
