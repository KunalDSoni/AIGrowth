/**
 * AI-crawler parity check (OSI-005).
 *
 * Fetches a page as a human browser UA and again as an AI-crawler UA
 * (GPTBot / ClaudeBot / PerplexityBot / Google-Extended), then diffs what the
 * bot can see. Content or links present for humans but missing for the bot are
 * "hidden from AI" — a GEO-relevant signal for ai-access.ts.
 *
 * Both fetches obey robots.txt and the existing SSRF guards.
 */

import { assertPublicHost, type DnsLookup } from "@/lib/providers/crawler";
import { isAllowed, loadRobots } from "@/lib/providers/robots";
import { extractLinks } from "@/lib/providers/site-crawler";
import { htmlToMarkdown } from "@/lib/providers/content-extractor";

export const AI_CRAWLER_AGENTS: Record<string, string> = {
  gptbot: "GPTBot/1.0 (+https://openai.com/gptbot)",
  claudebot: "ClaudeBot/1.0 (+https://www.anthropic.com)",
  perplexitybot: "PerplexityBot/1.0 (+https://perplexity.ai/bot)",
  "google-extended": "Mozilla/5.0 (compatible; Google-Extended)",
};

const HUMAN_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export interface ParityResult {
  url: string;
  bot: string;
  robotsAllowsBot: boolean;
  humanWordCount: number;
  botWordCount: number;
  /** Positive => humans get materially more content than the bot. */
  wordCountDelta: number;
  humanLinkCount: number;
  botLinkCount: number;
  linksHiddenFromBot: number;
  blocked: boolean;
  observedAt: string;
}

async function fetchAs(url: URL, ua: string, fetchImpl: typeof fetch, timeoutMs: number, dnsLookup?: DnsLookup): Promise<string | null> {
  await assertPublicHost(url, dnsLookup);
  try {
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": ua },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function wordCount(markdown: string): number {
  return (markdown.match(/[a-z0-9]+/gi) ?? []).length;
}

export async function checkAiCrawlerParity(
  target: string,
  bot: keyof typeof AI_CRAWLER_AGENTS = "gptbot",
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number; respectRobots?: boolean; dnsLookup?: DnsLookup } = {},
): Promise<ParityResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const botUa = AI_CRAWLER_AGENTS[bot];
  const url = new URL(target);

  const robots =
    opts.respectRobots === false
      ? { rules: [], crawlDelayMs: 0, sitemaps: [] }
      : await loadRobots(url.origin, botUa, fetchImpl, timeoutMs);
  const robotsAllowsBot = isAllowed(robots, url.pathname);

  const [humanHtml, botHtml] = await Promise.all([
    fetchAs(url, HUMAN_UA, fetchImpl, timeoutMs, opts.dnsLookup),
    robotsAllowsBot ? fetchAs(url, botUa, fetchImpl, timeoutMs, opts.dnsLookup) : Promise.resolve(null),
  ]);

  const human = humanHtml ? htmlToMarkdown(humanHtml) : { markdown: "", structured: undefined };
  const botContent = botHtml ? htmlToMarkdown(botHtml) : { markdown: "", structured: undefined };
  const humanLinks = humanHtml ? extractLinks(humanHtml, url.toString()) : [];
  const botLinks = botHtml ? extractLinks(botHtml, url.toString()) : [];
  const botLinkSet = new Set(botLinks);
  const linksHiddenFromBot = humanLinks.filter((l) => !botLinkSet.has(l)).length;

  const humanWordCount = wordCount(human.markdown);
  const botWordCount = wordCount(botContent.markdown);

  return {
    url: url.toString(),
    bot,
    robotsAllowsBot,
    humanWordCount,
    botWordCount,
    wordCountDelta: humanWordCount - botWordCount,
    humanLinkCount: humanLinks.length,
    botLinkCount: botLinks.length,
    linksHiddenFromBot,
    blocked: !robotsAllowsBot || (humanWordCount > 50 && botWordCount < humanWordCount * 0.5),
    observedAt: new Date().toISOString(),
  };
}
