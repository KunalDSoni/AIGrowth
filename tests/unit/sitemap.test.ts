import { describe, expect, it } from "vitest";
import { parseSitemap, sameOriginUnique } from "@/lib/engines/sitemap";

describe("parseSitemap", () => {
  it("parses a urlset into pages", () => {
    const xml = `<?xml version="1.0"?><urlset><url><loc>https://x.com/</loc></url><url><loc>https://x.com/a</loc></url></urlset>`;
    const parsed = parseSitemap(xml);
    expect(parsed.pages).toEqual(["https://x.com/", "https://x.com/a"]);
    expect(parsed.sitemaps).toHaveLength(0);
  });

  it("parses a sitemapindex into child sitemaps", () => {
    const xml = `<sitemapindex><sitemap><loc>https://x.com/sitemap-1.xml</loc></sitemap></sitemapindex>`;
    const parsed = parseSitemap(xml);
    expect(parsed.sitemaps).toEqual(["https://x.com/sitemap-1.xml"]);
    expect(parsed.pages).toHaveLength(0);
  });
});

describe("sameOriginUnique", () => {
  it("keeps only same-origin urls and de-dupes", () => {
    const out = sameOriginUnique(
      ["https://x.com/a", "https://x.com/a", "https://other.com/b", "https://x.com/c"],
      "https://x.com",
    );
    expect(out).toEqual(["https://x.com/a", "https://x.com/c"]);
  });

  it("drops malformed urls", () => {
    expect(sameOriginUnique(["not a url", "https://x.com/ok"], "https://x.com")).toEqual(["https://x.com/ok"]);
  });
});
