import type { CitationLedger } from "@/lib/analyze/types";

/**
 * GIL-02 — Cited-source answer-fitness feature extraction.
 *
 * For the competitor sources the GIL-01 ledger says beat the brand, extract the
 * GEO-specific "answer-fitness" features that make a page citable by answer
 * engines. Two units: a pure HTML heuristic extractor and a thin orchestrator
 * that crawls the top-cited sources via an injected safe crawler.
 *
 * Every feature is a directional heuristic — a `true` always traces to a pattern
 * actually present in the crawled HTML; the extractor invents nothing.
 */

export interface AnswerFitnessFeatures {
  hasDirectAnswer: boolean;
  hasFaqStructure: boolean;
  hasComparisonContent: boolean;
  hasStructuredPricing: boolean;
  hasFreshnessSignal: boolean;
  hasStructuredData: boolean;
  hasProofSignal: boolean;
  wordCount: number;
}

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractAnswerFitness(html: string, now: Date = new Date()): AnswerFitnessFeatures {
  const text = visibleText(html);
  const lower = text.toLowerCase();
  const htmlLower = html.toLowerCase();

  const leadWords = text.split(/\s+/).slice(0, 40).join(" ");
  const questionHeadings = [...html.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)].filter((m) =>
    m[1].replace(/<[^>]+>/g, " ").trim().endsWith("?"),
  ).length;

  const hasDirectAnswer =
    /\b(is|are|means|refers to)\b/i.test(leadWords) && text.length > 0 && leadWords.trim().split(/\s+/).length >= 3;

  const hasFaqStructure = /"faqpage"/i.test(html) || questionHeadings >= 2;

  const hasComparisonContent =
    /\b(vs\.?|versus|compared?|comparison|alternative to)\b/i.test(lower) ||
    /<th[^>]*>\s*(features?|us|vs)\b/i.test(htmlLower);

  const hasStructuredPricing =
    /"(pricespecification|offer)"/i.test(html) ||
    /\b(pricing|per month|per year)\b/i.test(lower) ||
    /\$\d/.test(text) ||
    /\d+\s*\/\s*mo\b/i.test(lower);

  const currentYear = now.getUTCFullYear();
  const yearFresh = new RegExp(`\\b(${currentYear}|${currentYear - 1})\\b`).test(text);
  const hasFreshnessSignal =
    /"date(modified|published)"/i.test(html) || /\b(updated|last reviewed|as of)\b/i.test(lower) || yearFresh;

  const hasStructuredData = /application\/ld\+json/i.test(html);

  const hasProofSignal =
    /\b(case stud|testimonial|review|certified|accredited|guarantee|clients? include|trusted by)\b/i.test(lower);

  const wordCount = text ? text.split(/\s+/).length : 0;

  return {
    hasDirectAnswer,
    hasFaqStructure,
    hasComparisonContent,
    hasStructuredPricing,
    hasFreshnessSignal,
    hasStructuredData,
    hasProofSignal,
    wordCount,
  };
}

export type CitedSourceCrawlStatus = "extracted" | "unreachable" | "skipped";

export interface CitedSourceFeatureProfile {
  url: string;
  domain: string;
  citedForPrompts: string[];
  citationCount: number;
  crawlStatus: CitedSourceCrawlStatus;
  features?: AnswerFitnessFeatures;
  note?: string;
}

/** Structural crawler interface — SafeWebsiteCrawler satisfies it (CrawledPageEvidence). */
export interface CitedSourceCrawler {
  crawl(url: string): Promise<{ rawHtml?: string; finalUrl: string; statusCode: number }>;
}

export interface BuildCitedSourceProfilesOptions {
  crawler: CitedSourceCrawler;
  limit?: number;
}

export async function buildCitedSourceProfiles(
  ledger: CitationLedger,
  opts: BuildCitedSourceProfilesOptions,
): Promise<CitedSourceFeatureProfile[]> {
  const limit = opts.limit ?? 5;
  const domains = ledger.competitorFrequency.slice(0, limit);

  const profiles: CitedSourceFeatureProfile[] = [];
  for (const { domain, count } of domains) {
    const source = ledger.records
      .flatMap((r) => r.citedSources)
      .find((c) => c.domain === domain && c.classification === "other");
    if (!source) continue;
    const citedForPrompts = ledger.records
      .filter((r) => r.citedSources.some((c) => c.domain === domain))
      .map((r) => r.promptId);

    const base = { url: source.url, domain, citedForPrompts, citationCount: count };
    try {
      const page = await opts.crawler.crawl(source.url);
      if (page.rawHtml && page.statusCode >= 200 && page.statusCode < 300) {
        profiles.push({ ...base, crawlStatus: "extracted", features: extractAnswerFitness(page.rawHtml) });
      } else {
        profiles.push({ ...base, crawlStatus: "unreachable", note: `HTTP ${page.statusCode} or empty body` });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "crawl failed";
      profiles.push({ ...base, crawlStatus: "unreachable", note: message });
    }
  }
  return profiles;
}
