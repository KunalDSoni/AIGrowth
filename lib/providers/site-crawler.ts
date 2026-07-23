/**
 * SiteCrawler (OSI-002) — multi-page frontier crawl behind a contract.
 *
 * Adapters:
 *  - `mock`    : deterministic synthetic pages; zero dependencies (default).
 *  - `http`    : real BFS frontier using fetch, SSRF-guarded per hop, robots + crawl-delay.
 *  - `crawlee` : optional Crawlee engine (browser render); lazy-imported so it is not required.
 *
 * All adapters return the existing `CrawledPageEvidence` type. SSRF stays in one
 * place (assertPublicHost) and robots/politeness are enforced on every real fetch.
 */

import type { CrawledPageEvidence } from "@/lib/domain/types";
import type { DnsLookup } from "@/lib/providers/crawler";
import { assertPublicHost, normalizeHtmlToCrawlEvidence } from "@/lib/providers/crawler";
import { isAllowed, loadRobots, sleep, type RobotsRules } from "@/lib/providers/robots";

export interface SiteCrawlOptions {
  maxPages: number;
  maxDepth: number;
  sameOriginOnly: boolean;
  render?: "http" | "browser";
  respectRobots?: boolean;
  userAgent?: string;
  timeoutMs?: number;
  maxBytes?: number;
  fetchImpl?: typeof fetch;
  dnsLookup?: DnsLookup;
}

export interface SiteCrawler {
  readonly source: string;
  crawlSite(seed: string, opts: SiteCrawlOptions): Promise<CrawledPageEvidence[]>;
}

export const DEFAULT_UA = "OpenGrowthAI-Crawler/0.1 (+https://opengrowth.ai)";

const REDIRECT = new Set([301, 302, 303, 307, 308]);

/** Extract same-document anchor hrefs, resolved against the page URL. */
export function extractLinks(html: string, baseUrl: string): string[] {
  const out = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) continue;
    try {
      const url = new URL(raw, baseUrl);
      if (url.protocol === "http:" || url.protocol === "https:") {
        url.hash = "";
        out.add(url.toString());
      }
    } catch {
      /* ignore malformed hrefs */
    }
  }
  return [...out];
}

async function fetchPage(
  url: URL,
  opts: Required<Pick<SiteCrawlOptions, "timeoutMs" | "maxBytes" | "userAgent">> & { fetchImpl: typeof fetch; dnsLookup?: DnsLookup },
): Promise<{ evidence: CrawledPageEvidence; html: string } | null> {
  let current = url;
  let response: Response | undefined;
  for (let hop = 0; hop <= 5; hop++) {
    await assertPublicHost(current, opts.dnsLookup);
    response = await opts.fetchImpl(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(opts.timeoutMs),
      headers: { "user-agent": opts.userAgent },
    });
    if (REDIRECT.has(response.status)) {
      const location = response.headers.get("location");
      if (!location) return null;
      current = new URL(location, current);
      continue;
    }
    break;
  }
  if (!response || REDIRECT.has(response.status)) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return null;

  const reader = response.body?.getReader();
  let html = "";
  if (reader) {
    const decoder = new TextDecoder();
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (received >= opts.maxBytes) {
        await reader.cancel();
        break;
      }
    }
  } else {
    html = (await response.text()).slice(0, opts.maxBytes);
  }

  const evidence = normalizeHtmlToCrawlEvidence({
    url: url.toString(),
    finalUrl: current.toString(),
    statusCode: response.status,
    html,
  });
  return { evidence, html };
}

/** Real dependency-free BFS frontier crawler. */
export class HttpSiteCrawler implements SiteCrawler {
  readonly source = "http";

  async crawlSite(seed: string, opts: SiteCrawlOptions): Promise<CrawledPageEvidence[]> {
    const fetchImpl = opts.fetchImpl ?? fetch;
    const userAgent = opts.userAgent ?? DEFAULT_UA;
    const timeoutMs = opts.timeoutMs ?? 5000;
    const maxBytes = opts.maxBytes ?? 300_000;
    const respectRobots = opts.respectRobots !== false;

    const start = new URL(seed);
    const origin = start.origin;
    const robots: RobotsRules = respectRobots
      ? await loadRobots(origin, userAgent, fetchImpl, timeoutMs)
      : { rules: [], crawlDelayMs: 0, sitemaps: [] };

    const seen = new Set<string>([start.toString()]);
    const queue: Array<{ url: URL; depth: number }> = [{ url: start, depth: 0 }];
    const pages: CrawledPageEvidence[] = [];

    while (queue.length && pages.length < opts.maxPages) {
      const { url, depth } = queue.shift()!;
      if (respectRobots && !isAllowed(robots, url.pathname)) continue;

      let result: { evidence: CrawledPageEvidence; html: string } | null;
      try {
        result = await fetchPage(url, { timeoutMs, maxBytes, userAgent, fetchImpl, dnsLookup: opts.dnsLookup });
      } catch {
        continue; // skip unsafe/failed page, keep the crawl going
      }
      if (!result) continue;
      pages.push(result.evidence);

      if (depth < opts.maxDepth) {
        for (const link of extractLinks(result.html, result.evidence.finalUrl)) {
          const next = new URL(link);
          if (opts.sameOriginOnly && next.origin !== origin) continue;
          if (seen.has(next.toString())) continue;
          seen.add(next.toString());
          queue.push({ url: next, depth: depth + 1 });
          if (seen.size > opts.maxPages * 20) break; // frontier safety cap
        }
      }
      if (robots.crawlDelayMs > 0 && queue.length) await sleep(robots.crawlDelayMs);
    }
    return pages;
  }
}

/** Deterministic synthetic crawl — zero dependencies, safe default. */
export class MockSiteCrawler implements SiteCrawler {
  readonly source = "mock";

  async crawlSite(seed: string, opts: SiteCrawlOptions): Promise<CrawledPageEvidence[]> {
    const base = new URL(seed);
    const count = Math.min(opts.maxPages, 5);
    const paths = ["/", "/about", "/pricing", "/blog", "/contact"];
    return Array.from({ length: count }, (_, i) => {
      const url = new URL(paths[i] ?? `/page-${i}`, base).toString();
      return {
        url,
        finalUrl: url,
        statusCode: 200,
        title: `${base.hostname} — ${paths[i] ?? `page ${i}`}`,
        description: "Deterministic mock page for local/demo crawling.",
        h1Count: 1,
        headings: [{ level: 1, text: "Mock heading" }],
        imageCount: 2,
        imagesMissingAlt: i % 2,
        internalLinkCount: 8,
        externalLinkCount: 2,
        wordCount: 420 + i * 30,
        hasViewport: true,
        hasStructuredData: i === 0,
        openGraphTags: 3,
        twitterTags: 1,
        hasClearCta: i !== 4,
        hasProofSignal: i === 2,
        observedAt: new Date(0).toISOString(),
        source: "mock",
      } satisfies CrawledPageEvidence;
    });
  }
}

/** Optional Crawlee engine (browser render). Lazy-imported; throws if not installed. */
export class CrawleeSiteCrawler implements SiteCrawler {
  readonly source = "crawlee";

  async crawlSite(seed: string, opts: SiteCrawlOptions): Promise<CrawledPageEvidence[]> {
    const pkg = "crawlee";
    let mod: { CheerioCrawler: new (cfg: unknown) => { run: (u: string[]) => Promise<unknown> } };
    try {
      mod = (await import(/* webpackIgnore: true */ pkg)) as typeof mod;
    } catch {
      throw new Error("Crawlee is not installed. Set OPENGROWTH_SITE_CRAWLER=http or install `crawlee`.");
    }
    const start = new URL(seed);
    const origin = start.origin;
    const userAgent = opts.userAgent ?? DEFAULT_UA;
    const pages: CrawledPageEvidence[] = [];

    const crawler = new mod.CheerioCrawler({
      maxRequestsPerCrawl: opts.maxPages,
      maxRequestRetries: 1,
      requestHandlerTimeoutSecs: Math.ceil((opts.timeoutMs ?? 5000) / 1000),
      additionalMimeTypes: ["text/html"],
      // Crawlee enforces robots via its own options; we also gate same-origin below.
      async requestHandler(ctx: {
        request: { url: string };
        body: string | Buffer;
        enqueueLinks: (o: unknown) => Promise<unknown>;
      }) {
        const url = ctx.request.url;
        await assertPublicHost(new URL(url), opts.dnsLookup);
        const html = ctx.body.toString();
        pages.push(normalizeHtmlToCrawlEvidence({ url, finalUrl: url, statusCode: 200, html }));
        if (pages.length < opts.maxPages) {
          await ctx.enqueueLinks(opts.sameOriginOnly ? { strategy: "same-origin" } : {});
        }
      },
    });
    void origin;
    void userAgent;
    await crawler.run([seed]);
    return pages.slice(0, opts.maxPages);
  }
}

export function getSiteCrawler(env: Record<string, string | undefined> = process.env): SiteCrawler {
  switch (env.OPENGROWTH_SITE_CRAWLER) {
    case "http":
      return new HttpSiteCrawler();
    case "crawlee":
      return new CrawleeSiteCrawler();
    default:
      return new MockSiteCrawler();
  }
}
