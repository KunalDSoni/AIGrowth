import { describe, it, expect } from "vitest";
import { htmlToMarkdown, CheerioContentExtractor, getContentExtractor } from "@/lib/providers/content-extractor";
import { MockEmbeddingProvider } from "@/lib/providers/embeddings";
import { MemoryEvidenceIndex, cosine, getEvidenceIndex } from "@/lib/providers/evidence-index";

describe("htmlToMarkdown (OSI-007)", () => {
  it("emits markdown and extracts JSON-LD", () => {
    const { markdown, structured } = htmlToMarkdown(
      `<html><head><script type="application/ld+json">{"@type":"Org"}</script></head>
       <body><nav>skip</nav><main><h1>Title</h1><p>Body text</p><ul><li>one</li></ul></main></body></html>`,
    );
    expect(markdown).toContain("# Title");
    expect(markdown).toContain("Body text");
    expect(markdown).toContain("- one");
    expect(structured).toEqual([{ "@type": "Org" }]);
  });

  it("CheerioContentExtractor uses provided html without fetching", async () => {
    const r = await new CheerioContentExtractor().extract("https://x.com/p", { html: "<h1>Hi</h1>" });
    expect(r.source).toBe("cheerio");
    expect(r.markdown).toContain("# Hi");
  });

  it("factory defaults to cheerio", () => {
    expect(getContentExtractor({}).source).toBe("cheerio");
  });
});

describe("embeddings + evidence index (OSI-009/010)", () => {
  it("mock embeddings are deterministic and cosine-comparable", async () => {
    const e = new MockEmbeddingProvider();
    const [a1] = await e.embed(["growth engine seo geo"]);
    const [a2] = await e.embed(["growth engine seo geo"]);
    const [b] = await e.embed(["unrelated cooking recipe"]);
    expect(a1).toEqual(a2);
    expect(cosine(a1, a2)).toBeCloseTo(1, 5);
    expect(cosine(a1, b)).toBeLessThan(0.9);
  });

  it("memory index ranks the relevant doc first", async () => {
    const index = new MemoryEvidenceIndex(new MockEmbeddingProvider());
    await index.upsert([
      { id: "1", text: "seo audit crawl technical", source: "crawl", measurement: "measured", observedAt: "t" },
      { id: "2", text: "banana bread baking recipe", source: "crawl", measurement: "measured", observedAt: "t" },
    ]);
    const hits = await index.search({ text: "technical seo crawl", k: 2 });
    expect(hits[0].doc.id).toBe("1");
  });

  it("respects filters", async () => {
    const index = new MemoryEvidenceIndex(new MockEmbeddingProvider());
    await index.upsert([
      { id: "p", text: "page content", source: "crawl", measurement: "measured", observedAt: "t", filters: { kind: "page" } },
      { id: "g", text: "page content", source: "geo", measurement: "simulated", observedAt: "t", filters: { kind: "geo-observation" } },
    ]);
    const hits = await index.search({ text: "page content", filters: { kind: "geo-observation" }, k: 5 });
    expect(hits.map((h) => h.doc.id)).toEqual(["g"]);
  });

  it("factory defaults to memory", () => {
    expect(getEvidenceIndex({}).source).toBe("memory");
  });
});
