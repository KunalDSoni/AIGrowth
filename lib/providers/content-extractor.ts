/**
 * ContentExtractor (OSI-007) — turn a page into clean LLM-ready markdown + structure.
 *
 *  - `cheerio`  : dependency-free (cheerio is already a project dep); strips chrome,
 *                 emits markdown-ish text + basic structured data (JSON-LD). Default.
 *  - `firecrawl`: HTTP adapter for a self-hosted or hosted Firecrawl; lazy over fetch.
 *
 * Firecrawl's own crawl mode is intentionally unused — Crawlee/SiteCrawler own
 * fetching so SSRF enforcement lives in one place.
 */

import * as cheerio from "cheerio";
import { assertPublicHost } from "@/lib/providers/crawler";

export type ExtractSource = "cheerio" | "firecrawl";

export interface ExtractResult {
  url: string;
  markdown: string;
  structured?: unknown;
  source: ExtractSource;
  observedAt: string;
}

export interface ExtractOptions {
  /** Pre-fetched HTML (skips the network round-trip when the crawl store already has it). */
  html?: string;
  schema?: unknown;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface ContentExtractor {
  readonly source: ExtractSource;
  extract(url: string, opts?: ExtractOptions): Promise<ExtractResult>;
}

/** Very small HTML→markdown reducer over the meaningful content. */
export function htmlToMarkdown(html: string): { markdown: string; structured: unknown } {
  const $ = cheerio.load(html);
  const jsonLd: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      jsonLd.push(JSON.parse($(el).text()));
    } catch {
      /* skip invalid JSON-LD */
    }
  });
  $("script, style, noscript, nav, footer, header, form, aside, svg").remove();

  const lines: string[] = [];
  const root = $("main").length ? $("main") : $("body");
  root.find("h1, h2, h3, h4, p, li").each((_, el) => {
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? "";
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!text) return;
    if (tag === "h1") lines.push(`# ${text}`);
    else if (tag === "h2") lines.push(`## ${text}`);
    else if (tag === "h3") lines.push(`### ${text}`);
    else if (tag === "h4") lines.push(`#### ${text}`);
    else if (tag === "li") lines.push(`- ${text}`);
    else lines.push(text);
  });
  return {
    markdown: lines.join("\n\n").slice(0, 100_000),
    structured: jsonLd.length ? jsonLd : undefined,
  };
}

export class CheerioContentExtractor implements ContentExtractor {
  readonly source = "cheerio" as const;

  async extract(url: string, opts: ExtractOptions = {}): Promise<ExtractResult> {
    let html = opts.html;
    if (html === undefined) {
      const target = new URL(url);
      await assertPublicHost(target);
      const res = await (opts.fetchImpl ?? fetch)(target, {
        signal: AbortSignal.timeout(opts.timeoutMs ?? 5000),
        headers: { "user-agent": "OpenGrowthAI-Extractor/0.1 (+https://opengrowth.ai)" },
      });
      html = await res.text();
    }
    const { markdown, structured } = htmlToMarkdown(html);
    return { url, markdown, structured, source: this.source, observedAt: new Date().toISOString() };
  }
}

/** Firecrawl self-host/API adapter. Requires FIRECRAWL_URL (+ optional FIRECRAWL_API_KEY). */
export class FirecrawlContentExtractor implements ContentExtractor {
  readonly source = "firecrawl" as const;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async extract(url: string, opts: ExtractOptions = {}): Promise<ExtractResult> {
    const res = await this.fetchImpl(new URL("/v1/scrape", this.baseUrl), {
      method: "POST",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({ url, formats: ["markdown", "json"], jsonOptions: opts.schema ? { schema: opts.schema } : undefined }),
    });
    if (!res.ok) throw new Error(`Firecrawl returned ${res.status}`);
    const data = (await res.json()) as { data?: { markdown?: string; json?: unknown } };
    return {
      url,
      markdown: data.data?.markdown ?? "",
      structured: data.data?.json,
      source: this.source,
      observedAt: new Date().toISOString(),
    };
  }
}

export function getContentExtractor(env: Record<string, string | undefined> = process.env): ContentExtractor {
  if (env.OPENGROWTH_EXTRACTOR === "firecrawl" && env.FIRECRAWL_URL) {
    return new FirecrawlContentExtractor(env.FIRECRAWL_URL, env.FIRECRAWL_API_KEY);
  }
  return new CheerioContentExtractor();
}
