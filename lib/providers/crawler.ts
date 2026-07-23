import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { CrawledPageEvidence } from "@/lib/domain/types";
import type { WebsiteCrawler } from "@/lib/providers/contracts";

const MAX_REDIRECTS = 5;
const ALLOWED_PORTS = new Set(["", "80", "443"]);
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const privateRanges = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT / carrier-grade NAT
];

export type DnsLookup = (hostname: string) => Promise<Array<{ address: string }>>;

export function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80")) return true;
  if (normalized === "169.254.169.254") return true;
  return privateRanges.some((range) => range.test(normalized));
}

function defaultDnsLookup(hostname: string) {
  return lookup(hostname, { all: true, verbatim: true });
}

/** SSRF guard: protocol, port, hostname, and DNS/private-IP checks. */
export async function assertPublicHost(url: URL, dnsLookup: DnsLookup = defaultDnsLookup) {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs can be crawled.");
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new Error("Only ports 80 and 443 can be crawled.");
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Local or metadata hostnames cannot be crawled.");
  }
  if (isIP(url.hostname) && isPrivateAddress(url.hostname)) {
    throw new Error("Private network targets cannot be crawled.");
  }
  const records = await dnsLookup(url.hostname);
  if (!records.length || records.some((record) => isPrivateAddress(record.address))) {
    throw new Error("Resolved private network targets cannot be crawled.");
  }
}

function textOf(html: string, pattern: RegExp) {
  const match = html.match(pattern);
  return match?.[1]?.replace(/\s+/g, " ").trim();
}

function count(html: string, pattern: RegExp) {
  return [...html.matchAll(pattern)].length;
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}=["']([^"']*)["']`, "i"));
  return match?.[1]?.trim();
}

export function normalizeHtmlToCrawlEvidence(input: {
  url: string;
  finalUrl: string;
  statusCode: number;
  html: string;
  observedAt?: string;
}): CrawledPageEvidence {
  const html = input.html;
  const origin = new URL(input.finalUrl).origin;
  const headings = [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .slice(0, 20)
    .map((match) => ({
      level: Number(match[1]),
      text: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    }))
    .filter((heading) => heading.text);
  const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  const anchorTags = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  const visibleText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const textLower = visibleText.toLowerCase();
  const hasClearCta =
    /\b(book|contact|get started|schedule|request a quote|sign up|try free|buy now|call us|enquire|enquir)\b/i.test(
      textLower,
    ) ||
    /<(button|a)\b[^>]*>[^<]*(book|contact|get started|quote|sign up)[^<]*<\/(button|a)>/i.test(html);
  const hasProofSignal =
    /\b(case stud|testimonial|review|certified|accredited|guarantee|clients? include|trusted by)\b/i.test(textLower);
  const language =
    textOf(html, /<html\b[^>]*\slang=["']([^"']+)["'][^>]*>/i) ??
    textOf(html, /<meta\b[^>]*http-equiv=["']content-language["'][^>]*content=["']([^"']+)["'][^>]*>/i);

  const evidence: CrawledPageEvidence = {
    url: input.url,
    finalUrl: input.finalUrl,
    statusCode: input.statusCode,
    title: textOf(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description:
      textOf(html, /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ??
      textOf(html, /<meta\b[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i),
    canonical: textOf(html, /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i),
    language,
    h1Count: headings.filter((heading) => heading.level === 1).length,
    headings,
    imageCount: imageTags.length,
    imagesMissingAlt: imageTags.filter((tag) => !attr(tag, "alt")).length,
    internalLinkCount: anchorTags.filter((href) => href.startsWith("/") || href.startsWith(origin)).length,
    externalLinkCount: anchorTags.filter((href) => /^https?:\/\//i.test(href) && !href.startsWith(origin)).length,
    wordCount: visibleText.trim() ? visibleText.trim().split(/\s+/).length : 0,
    hasViewport: /<meta\b[^>]*name=["']viewport["']/i.test(html),
    hasStructuredData: /application\/ld\+json/i.test(html),
    robotsDirectives: textOf(html, /<meta\b[^>]*name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/i),
    openGraphTags: count(html, /<meta\b[^>]*property=["']og:/gi),
    twitterTags: count(html, /<meta\b[^>]*name=["']twitter:/gi),
    hasClearCta,
    hasProofSignal,
    observedAt: input.observedAt ?? new Date().toISOString(),
    source: "safe-crawler",
  };
  Object.defineProperty(evidence, "rawHtml", { value: html, enumerable: false });
  return evidence;
}

async function limitedText(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) throw new Error("Crawled content exceeded the maximum allowed size.");
    chunks.push(value);
  }
  return new TextDecoder().decode(Uint8Array.from(chunks.flatMap((chunk) => [...chunk])));
}

function isRedirectStatus(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

export type SafeCrawlerOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  fetchImpl?: typeof fetch;
  dnsLookup?: DnsLookup;
};

export class SafeWebsiteCrawler implements WebsiteCrawler {
  constructor(private readonly defaults: SafeCrawlerOptions = {}) {}

  async crawl(url: string, options: SafeCrawlerOptions = {}) {
    const timeoutMs = options.timeoutMs ?? this.defaults.timeoutMs ?? Number(process.env.CRAWLER_TIMEOUT_MS ?? 5000);
    const maxBytes = options.maxBytes ?? this.defaults.maxBytes ?? Number(process.env.CRAWLER_MAX_BYTES ?? 300_000);
    const fetchImpl = options.fetchImpl ?? this.defaults.fetchImpl ?? fetch;
    const dnsLookup = options.dnsLookup ?? this.defaults.dnsLookup ?? defaultDnsLookup;

    const start = new URL(url);
    let current = start;
    let response: Response | undefined;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicHost(current, dnsLookup);
      response = await fetchImpl(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "user-agent": "OpenGrowthAI-DemoCrawler/0.1 (+https://opengrowth.ai)" },
      });

      if (isRedirectStatus(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Redirect response missing Location header.");
        current = new URL(location, current);
        continue;
      }
      break;
    }

    if (!response) throw new Error("Crawl failed before receiving a response.");
    if (isRedirectStatus(response.status)) throw new Error("Too many redirects while crawling.");

    await assertPublicHost(current, dnsLookup);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) throw new Error("Only HTML pages can be crawled.");
    const html = await limitedText(response, maxBytes);
    return normalizeHtmlToCrawlEvidence({
      url: start.toString(),
      finalUrl: current.toString(),
      statusCode: response.status,
      html,
    });
  }
}

/** Prefer live crawl when `OPENGROWTH_REAL_CRAWL=true`; otherwise still return the safe crawler for explicit callers. */
export function getWebsiteCrawler(env: Record<string, string | undefined> = process.env): SafeWebsiteCrawler {
  return new SafeWebsiteCrawler({
    timeoutMs: Number(env.CRAWLER_TIMEOUT_MS ?? 5000),
    maxBytes: Number(env.CRAWLER_MAX_BYTES ?? 300_000),
  });
}

export function isRealCrawlEnabled(env: Record<string, string | undefined> = process.env) {
  return env.OPENGROWTH_REAL_CRAWL === "true";
}
