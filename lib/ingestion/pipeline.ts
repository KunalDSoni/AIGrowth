/**
 * Ingestion pipeline (OSI-003 / OSI-008 integration point).
 *
 * Composes the OSI adapters into one call: crawl a site → persist + diff → index
 * the corpus. Additive: existing single-page flows are untouched; callers opt in.
 */

import type { CrawledPageEvidence } from "@/lib/domain/types";
import { getSiteCrawler, type SiteCrawlOptions, type SiteCrawler } from "@/lib/providers/site-crawler";
import { getEvidenceIndex, type EvidenceIndex } from "@/lib/providers/evidence-index";
import { recordCrawl, type CrawlRun } from "@/lib/ingestion/crawl-store";
import { indexCorpus } from "@/lib/ingestion/index-corpus";
import type { CrawlDiff } from "@/lib/engines/crawl-diff";

export interface PipelineOptions extends Partial<SiteCrawlOptions> {
  index?: boolean;
  crawler?: SiteCrawler;
  evidenceIndex?: EvidenceIndex;
}

export interface PipelineResult {
  pages: CrawledPageEvidence[];
  run: CrawlRun;
  diff: CrawlDiff | null;
  indexedDocs: number;
}

export async function crawlAndIngest(seed: string, opts: PipelineOptions = {}): Promise<PipelineResult> {
  const crawler = opts.crawler ?? getSiteCrawler();
  const pages = await crawler.crawlSite(seed, {
    maxPages: opts.maxPages ?? 20,
    maxDepth: opts.maxDepth ?? 2,
    sameOriginOnly: opts.sameOriginOnly ?? true,
    render: opts.render,
    respectRobots: opts.respectRobots,
    userAgent: opts.userAgent,
    timeoutMs: opts.timeoutMs,
    maxBytes: opts.maxBytes,
    fetchImpl: opts.fetchImpl,
    dnsLookup: opts.dnsLookup,
  });

  const domain = new URL(seed).hostname;
  const { run, diff } = recordCrawl(domain, pages);

  let indexedDocs = 0;
  if (opts.index) {
    const index = opts.evidenceIndex ?? getEvidenceIndex();
    indexedDocs = await indexCorpus(index, {
      pages,
      pageSource: crawler.source,
      pageMeasurement: crawler.source === "mock" ? "simulated" : "measured",
    });
  }

  return { pages, run, diff, indexedDocs };
}
