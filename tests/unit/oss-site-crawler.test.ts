import { describe, it, expect } from "vitest";
import {
  extractLinks,
  MockSiteCrawler,
  HttpSiteCrawler,
  getSiteCrawler,
} from "@/lib/providers/site-crawler";

const publicDns = async () => [{ address: "93.184.216.34" }];

function htmlPage(links: string[], words = "alpha beta gamma delta"): string {
  return `<html><body>${links.map((l) => `<a href="${l}">l</a>`).join("")}<h1>Head</h1><p>${words}</p></body></html>`;
}

function fixtureFetch(pages: Record<string, string>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
    const path = new URL(url).pathname;
    const body = pages[path];
    if (body === undefined) return new Response("missing", { status: 404 });
    return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
  }) as typeof fetch;
}

describe("extractLinks", () => {
  it("resolves and filters anchors", () => {
    const links = extractLinks(
      `<a href="/a">a</a><a href="https://x.com/b">b</a><a href="#frag">f</a><a href="mailto:x@y.com">m</a>`,
      "https://x.com/",
    );
    expect(links).toContain("https://x.com/a");
    expect(links).toContain("https://x.com/b");
    expect(links.some((l) => l.includes("frag") || l.includes("mailto"))).toBe(false);
  });
});

describe("MockSiteCrawler", () => {
  it("returns deterministic capped pages", async () => {
    const pages = await new MockSiteCrawler().crawlSite("https://demo.test/", {
      maxPages: 3,
      maxDepth: 2,
      sameOriginOnly: true,
    });
    expect(pages).toHaveLength(3);
    expect(pages[0].statusCode).toBe(200);
  });
});

describe("HttpSiteCrawler (BFS frontier)", () => {
  it("crawls same-origin links up to depth/page caps, robots-gated", async () => {
    const fetchImpl = fixtureFetch({
      "/": htmlPage(["/a", "/b", "https://other.test/x"]),
      "/a": htmlPage(["/c"]),
      "/b": htmlPage([]),
      "/c": htmlPage([]),
    });
    const pages = await new HttpSiteCrawler().crawlSite("https://demo.test/", {
      maxPages: 10,
      maxDepth: 1,
      sameOriginOnly: true,
      fetchImpl,
      dnsLookup: publicDns,
    });
    const paths = pages.map((p) => new URL(p.finalUrl).pathname).sort();
    // home + /a + /b (depth 1). /c is depth 2 (excluded), other.test excluded (cross-origin)
    expect(paths).toEqual(["/", "/a", "/b"]);
  });
});

describe("getSiteCrawler factory", () => {
  it("defaults to mock and selects http via env", () => {
    expect(getSiteCrawler({}).source).toBe("mock");
    expect(getSiteCrawler({ OPENGROWTH_SITE_CRAWLER: "http" }).source).toBe("http");
    expect(getSiteCrawler({ OPENGROWTH_SITE_CRAWLER: "crawlee" }).source).toBe("crawlee");
  });
});
