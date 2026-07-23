import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { CrawledPageEvidence } from "@/lib/domain/types";
import type { WebsiteCrawler } from "@/lib/providers/contracts";

const privateRanges = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
];

function isPrivateAddress(address: string) {
  if (address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80")) return true;
  return privateRanges.some((range) => range.test(address));
}

async function assertPublicHost(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP and HTTPS URLs can be crawled.");
  if (url.hostname.endsWith(".local")) throw new Error("Local hostnames cannot be crawled.");
  if (isIP(url.hostname) && isPrivateAddress(url.hostname)) throw new Error("Private network targets cannot be crawled.");
  const records = await lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => isPrivateAddress(record.address))) throw new Error("Resolved private network targets cannot be crawled.");
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

export function normalizeHtmlToCrawlEvidence(input: { url: string; finalUrl: string; statusCode: number; html: string; observedAt?: string }): CrawledPageEvidence {
  const html = input.html;
  const origin = new URL(input.finalUrl).origin;
  const headings = [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)].slice(0, 20).map((match) => ({
    level: Number(match[1]),
    text: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  })).filter((heading) => heading.text);
  const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  const anchorTags = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  const visibleText = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");

  const evidence: CrawledPageEvidence = {
    url: input.url,
    finalUrl: input.finalUrl,
    statusCode: input.statusCode,
    title: textOf(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description: textOf(html, /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ?? textOf(html, /<meta\b[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i),
    canonical: textOf(html, /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i),
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

export class SafeWebsiteCrawler implements WebsiteCrawler {
  async crawl(url: string, options: { timeoutMs?: number; maxBytes?: number } = {}) {
    const target = new URL(url);
    await assertPublicHost(target);
    const response = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
      headers: { "user-agent": "OpenGrowthAI-DemoCrawler/0.1 (+https://opengrowth.ai)" },
    });
    const finalUrl = response.url || target.toString();
    await assertPublicHost(new URL(finalUrl));
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) throw new Error("Only HTML pages can be crawled.");
    const html = await limitedText(response, options.maxBytes ?? 300_000);
    return normalizeHtmlToCrawlEvidence({ url: target.toString(), finalUrl, statusCode: response.status, html });
  }
}
