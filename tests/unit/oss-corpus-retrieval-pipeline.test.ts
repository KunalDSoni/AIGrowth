import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CrawledPageEvidence } from "@/lib/domain/types";
import { MemoryEvidenceIndex } from "@/lib/providers/evidence-index";
import { MockEmbeddingProvider } from "@/lib/providers/embeddings";
import { indexCorpus } from "@/lib/ingestion/index-corpus";
import { retrieveEvidence } from "@/lib/ingestion/retrieval";
import { crawlAndIngest } from "@/lib/ingestion/pipeline";
import { MockSiteCrawler } from "@/lib/providers/site-crawler";

function page(url: string, title: string, description: string): CrawledPageEvidence {
  return {
    url,
    finalUrl: url,
    statusCode: 200,
    title,
    description,
    h1Count: 1,
    headings: [{ level: 1, text: title }],
    imageCount: 0,
    imagesMissingAlt: 0,
    internalLinkCount: 0,
    externalLinkCount: 0,
    wordCount: 100,
    hasViewport: true,
    hasStructuredData: false,
    openGraphTags: 0,
    twitterTags: 0,
    hasClearCta: true,
    hasProofSignal: false,
    observedAt: "t",
    source: "mock",
  };
}

describe("corpus indexing + retrieval (OSI-011/012)", () => {
  it("indexes pages and retrieves the relevant one", async () => {
    const index = new MemoryEvidenceIndex(new MockEmbeddingProvider());
    const count = await indexCorpus(index, {
      pages: [
        page("https://x.com/pricing", "Pricing plans and cost", "monthly subscription pricing tiers"),
        page("https://x.com/careers", "Careers and jobs", "hiring team openings"),
      ],
    });
    expect(count).toBe(2);
    const good = await retrieveEvidence(index, "pricing subscription cost", { threshold: 0.2 });
    expect(good.hits[0].doc.id).toContain("pricing");
    expect(["sufficient", "directional"]).toContain(good.verdict);
  });

  it("returns an insufficient verdict on an empty index", async () => {
    const empty = await retrieveEvidence(new MemoryEvidenceIndex(new MockEmbeddingProvider()), "anything");
    expect(empty.verdict).toBe("insufficient");
    expect(empty.sufficient).toBe(false);
  });
});

describe("crawlAndIngest pipeline (OSI-003/008)", () => {
  beforeEach(() => {
    process.env.OPENGROWTH_DATA_DIR = mkdtempSync(join(tmpdir(), "pipeline-"));
  });

  it("crawls, persists, and indexes with mock adapters", async () => {
    const index = new MemoryEvidenceIndex(new MockEmbeddingProvider());
    const result = await crawlAndIngest("https://demo.test/", {
      crawler: new MockSiteCrawler(),
      evidenceIndex: index,
      index: true,
      maxPages: 4,
    });
    expect(result.pages.length).toBe(4);
    expect(result.indexedDocs).toBe(4);
    expect(result.run.domain).toBe("demo.test");
  });
});
