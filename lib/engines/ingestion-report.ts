/**
 * Ingestion report (OSI-003 / MDM-003 surfacing).
 *
 * Composes the OSI + MDM adapters into one evidence-labelled report for a domain:
 * multi-page crawl + full-site audit, change diff, AI-crawler parity, measured GEO,
 * Core Web Vitals, SERP snapshot, and authority — each carrying its source and a
 * measured | simulated | estimate label. Defaults are the zero-dependency mocks,
 * so this runs offline and stays honest about what is real vs modelled.
 */

import type { AuditIssue } from "@/lib/domain/types";
import type { MeasurementLabel } from "@/lib/providers/measurement";
import { getSiteCrawler } from "@/lib/providers/site-crawler";
import { getEvidenceIndex } from "@/lib/providers/evidence-index";
import { getPerformanceProvider, type PerformanceMetrics } from "@/lib/providers/performance";
import { getSerpProvider, type SerpResultItem } from "@/lib/providers/serp";
import { getBacklinkProvider } from "@/lib/providers/backlinks";
import { getAnswerEngineProvider } from "@/lib/providers/answer-engine";
import { crawlAndIngest } from "@/lib/ingestion/pipeline";
import { auditCrawledPage } from "@/lib/engines/live-audit";
import { measureGeo } from "@/lib/ingestion/geo-measurement";
import { checkAiCrawlerParity, type ParityResult } from "@/lib/ingestion/ai-crawler-parity";
import { retrieveEvidence } from "@/lib/ingestion/retrieval";
import type { CrawlDiff } from "@/lib/engines/crawl-diff";

export interface IngestionSection<T> {
  source: string;
  measurement: MeasurementLabel;
  data: T;
}

export interface IngestionReport {
  domain: string;
  generatedAt: string;
  crawl: IngestionSection<{ pagesScanned: number; indexedDocs: number; crawler: string }>;
  audit: IngestionSection<{ issueCount: number; critical: number; high: number; topIssues: AuditIssue[] }>;
  changes: CrawlDiff | null;
  parity: IngestionSection<ParityResult> | { skipped: true; reason: string };
  geo: IngestionSection<{ sampleSize: number; brandMentionRate: number; citationPresenceRate: number; prompts: string[] }>;
  performance: IngestionSection<PerformanceMetrics & { issueCount: number }>;
  serp: IngestionSection<{ query: string; results: SerpResultItem[] }>;
  authority: IngestionSection<{ score?: number; note?: string }>;
  retrieval: { query: string; verdict: string; topScore: number };
  guardrails: string[];
}

function brandOf(domain: string): string {
  return domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").split(".")[0];
}

export interface IngestionReportOptions {
  env?: Record<string, string | undefined>;
  /** Allow the network-dependent parity fetch (skipped by default for the offline demo). */
  allowLiveParity?: boolean;
  maxPages?: number;
}

export async function buildIngestionReport(domain: string, opts: IngestionReportOptions = {}): Promise<IngestionReport> {
  const env = opts.env ?? process.env;
  const seed = `https://${domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}/`;
  const brand = brandOf(domain);
  const index = getEvidenceIndex(env);
  const crawler = getSiteCrawler(env);

  // OSI-003/006/008/011 — crawl → store + diff → index.
  const pipeline = await crawlAndIngest(seed, { crawler, evidenceIndex: index, index: true, maxPages: opts.maxPages ?? 20 });

  // OSI-003 — full-site audit across every crawled page.
  const issues = pipeline.pages.flatMap((page) => auditCrawledPage(page));
  const crawlMeasurement: MeasurementLabel = crawler.source === "mock" ? "simulated" : "measured";
  const topIssues = [...issues].sort((a, b) => severityRank(b.severity) - severityRank(a.severity)).slice(0, 8);

  // OSI-005 — AI-crawler parity (network; opt-in).
  const liveParity = opts.allowLiveParity || env.OPENGROWTH_SITE_CRAWLER === "http" || env.OPENGROWTH_SITE_CRAWLER === "crawlee";
  let parity: IngestionReport["parity"];
  if (!liveParity) {
    parity = { skipped: true, reason: "Live parity fetch is off. Set OPENGROWTH_SITE_CRAWLER=http|crawlee to enable." };
  } else {
    try {
      const result = await checkAiCrawlerParity(seed, "gptbot");
      parity = { source: "http", measurement: "measured", data: result };
    } catch (error) {
      parity = { skipped: true, reason: `Parity fetch failed: ${(error as Error).message}` };
    }
  }

  // MDM-003 — measured GEO.
  const answerEngine = getAnswerEngineProvider(env);
  const prompts = [`What is ${brand}?`, `Is ${brand} a good option?`, `Best alternatives to ${brand}`];
  const geo = await measureGeo(answerEngine, prompts, { brand });

  // MDM-004/005/006 — performance, SERP, authority.
  const perf = await getPerformanceProvider(env).audit(seed);
  const serp = await getSerpProvider(env).search(`${brand} reviews`);
  const authority = await getBacklinkProvider(env).authority(domain);

  // OSI-012 — retrieval honesty check over the freshly indexed corpus.
  const retrieval = await retrieveEvidence(index, brand, { k: 5 });

  return {
    domain,
    generatedAt: new Date().toISOString(),
    crawl: {
      source: crawler.source,
      measurement: crawlMeasurement,
      data: { pagesScanned: pipeline.pages.length, indexedDocs: pipeline.indexedDocs, crawler: crawler.source },
    },
    audit: {
      source: crawler.source,
      measurement: crawlMeasurement,
      data: {
        issueCount: issues.length,
        critical: issues.filter((i) => i.severity === "critical").length,
        high: issues.filter((i) => i.severity === "high").length,
        topIssues,
      },
    },
    changes: pipeline.diff,
    parity,
    geo: {
      source: answerEngine.engines[0],
      measurement: geo.measurement,
      data: { sampleSize: geo.sampleSize, brandMentionRate: geo.brandMentionRate, citationPresenceRate: geo.citationPresenceRate, prompts },
    },
    performance: {
      source: perf.source,
      measurement: perf.measurement,
      data: { ...perf.metrics, issueCount: perf.issues.length },
    },
    serp: { source: serp.source, measurement: serp.measurement, data: { query: serp.query, results: serp.results } },
    authority: { source: authority.source, measurement: authority.measurement, data: { score: authority.authorityScore, note: authority.note } },
    retrieval: { query: retrieval.query, verdict: retrieval.verdict, topScore: retrieval.topScore },
    guardrails: [
      "Every section is labelled measured, simulated, or estimate — never blurred.",
      "Mock/default adapters produce simulated data offline; connect real engines via .env to measure.",
      "GEO stays directional unless every observation is measured against a real answer engine.",
    ],
  };
}

function severityRank(severity: AuditIssue["severity"]): number {
  return { critical: 4, high: 3, "quick-win": 2, monitor: 1, ignore: 0 }[severity] ?? 0;
}
