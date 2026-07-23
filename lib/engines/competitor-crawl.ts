/**
 * COMP depth — crawl a competitor homepage safely and compare against our live SEO snapshot.
 */

import { SafeWebsiteCrawler, type SafeCrawlerOptions } from "@/lib/providers/crawler";
import { auditCrawledPage } from "@/lib/engines/live-audit";
import { computeReadiness } from "@/lib/engines/readiness";
import { publicWebsiteSchema } from "@/lib/security/url";
import type { SeoResult } from "@/lib/analyze/types";

export interface CompetitorCrawlResult {
  domain: string;
  url: string;
  finalUrl: string;
  title: string | null;
  score: number;
  band: string;
  issueCount: number;
  critical: number;
  high: number;
  wordCount: number;
  hasStructuredData: boolean;
  hasClearCta: boolean;
  hasProofSignal: boolean;
  crawledAt: string;
}

export interface CompetitorComparison {
  ours: { domain: string; score: number; pagesScanned: number; critical: number; high: number };
  competitor: CompetitorCrawlResult;
  deltas: { score: number; critical: number; high: number };
  conclusions: string[];
}

export async function crawlCompetitorHomepage(
  urlInput: string,
  options: SafeCrawlerOptions = {},
): Promise<CompetitorCrawlResult> {
  const url = publicWebsiteSchema.parse(urlInput);
  const crawler = new SafeWebsiteCrawler(options);
  const evidence = await crawler.crawl(url, {
    timeoutMs: options.timeoutMs ?? 8000,
    maxBytes: options.maxBytes ?? 500_000,
  });
  const issues = auditCrawledPage(evidence);
  const metrics = computeReadiness(issues);
  const host = new URL(evidence.finalUrl).hostname.replace(/^www\./, "");
  return {
    domain: host,
    url,
    finalUrl: evidence.finalUrl,
    title: evidence.title ?? null,
    score: metrics.score,
    band: metrics.band,
    issueCount: issues.length,
    critical: metrics.critical,
    high: metrics.high,
    wordCount: evidence.wordCount,
    hasStructuredData: evidence.hasStructuredData,
    hasClearCta: evidence.hasClearCta,
    hasProofSignal: evidence.hasProofSignal,
    crawledAt: evidence.observedAt,
  };
}

export function compareWithOurSeo(
  ours: SeoResult,
  competitor: CompetitorCrawlResult,
  ourDomain: string,
): CompetitorComparison {
  const conclusions: string[] = [];
  const scoreDelta = ours.site.score - competitor.score;
  if (scoreDelta > 5) conclusions.push(`Your readiness score leads ${competitor.domain} by ${scoreDelta} points.`);
  else if (scoreDelta < -5) {
    conclusions.push(`${competitor.domain} leads your readiness score by ${Math.abs(scoreDelta)} points.`);
  } else {
    conclusions.push("Technical readiness is similar on the homepage sample.");
  }

  if (competitor.hasProofSignal && !ours.pages.some((p) => p.ok && p.observation?.hasProofSignal)) {
    conclusions.push(`${competitor.domain} shows proof signals on the homepage; your crawled pages do not.`);
  }
  if (competitor.hasClearCta && !ours.pages.some((p) => p.ok && p.observation?.hasClearCta)) {
    conclusions.push(`${competitor.domain} has clearer CTA language on the homepage sample.`);
  }
  if (competitor.hasStructuredData && ours.pages.filter((p) => p.ok && p.observation?.hasStructuredData).length === 0) {
    conclusions.push(`${competitor.domain} ships structured data; yours does not on scanned pages.`);
  }
  if (conclusions.length === 1) {
    conclusions.push("Crawl another competitor or deepen your site scan for stronger coverage comparisons.");
  }

  return {
    ours: {
      domain: ourDomain,
      score: ours.site.score,
      pagesScanned: ours.site.pagesScanned,
      critical: ours.site.critical,
      high: ours.site.high,
    },
    competitor,
    deltas: {
      score: scoreDelta,
      critical: ours.site.critical - competitor.critical,
      high: ours.site.high - competitor.high,
    },
    conclusions,
  };
}
