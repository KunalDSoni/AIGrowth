import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CrawledPageEvidence } from "@/lib/domain/types";
import { saveRun, loadRuns, latestRun, recordCrawl, diffAgainstPrevious } from "@/lib/ingestion/crawl-store";

function page(url: string, wordCount = 100, title = "T"): CrawledPageEvidence {
  return {
    url,
    finalUrl: url,
    statusCode: 200,
    title,
    h1Count: 1,
    headings: [],
    imageCount: 0,
    imagesMissingAlt: 0,
    internalLinkCount: 0,
    externalLinkCount: 0,
    wordCount,
    hasViewport: true,
    hasStructuredData: false,
    openGraphTags: 0,
    twitterTags: 0,
    hasClearCta: false,
    hasProofSignal: false,
    observedAt: new Date().toISOString(),
    source: "mock",
  };
}

describe("crawl store + incremental diff (OSI-006)", () => {
  beforeEach(() => {
    process.env.OPENGROWTH_DATA_DIR = mkdtempSync(join(tmpdir(), "crawlstore-"));
  });

  it("persists and reloads runs per domain", () => {
    saveRun("example.com", [page("https://example.com/")]);
    const runs = loadRuns("https://example.com");
    expect(runs).toHaveLength(1);
    expect(latestRun("example.com")?.pages[0].url).toBe("https://example.com/");
  });

  it("caps retained runs", () => {
    for (let i = 0; i < 8; i++) saveRun("d.com", [page(`https://d.com/${i}`)], 3);
    expect(loadRuns("d.com")).toHaveLength(3);
  });

  it("recordCrawl diffs against the previous run", () => {
    recordCrawl("shop.com", [page("https://shop.com/a"), page("https://shop.com/b")]);
    const second = recordCrawl("shop.com", [
      page("https://shop.com/a", 250), // changed word count -> changed
      page("https://shop.com/c"), // added
    ]);
    expect(second.diff).not.toBeNull();
    expect(second.diff!.added.map((p) => p.url)).toContain("https://shop.com/c");
    expect(second.diff!.removed.map((p) => p.url)).toContain("https://shop.com/b");
    expect(second.diff!.changed.some((c) => c.url.includes("/a"))).toBe(true);
  });

  it("returns null diff when no prior run exists", () => {
    expect(diffAgainstPrevious("fresh.com")).toBeNull();
  });
});
