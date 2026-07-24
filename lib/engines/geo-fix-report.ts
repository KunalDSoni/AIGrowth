/**
 * GIL-06 — GEO Fix surface compose.
 *
 * Runs the Stage A→B pipeline over a persisted analyze result:
 *   ledger (GIL-01) → cited-source profiles (GIL-02) → brand gap diff (GIL-03)
 *   → citation-fix plan (GIL-05).
 *
 * The *diagnosis* half (coverage, who beat you, where you're absent) is available
 * offline from the persisted GEO run. The *fix recommendations* require a live
 * crawl of the cited sources and the brand's own page; without a crawler the
 * report honestly returns diagnosis-only.
 */

import type { AnalyzeResult, GeoResult } from "@/lib/analyze/types";
import type { PromptCitationStatus } from "@/lib/analyze/types";
import { buildCitationLedger } from "@/lib/engines/geo-citation-ledger";
import {
  buildCitedSourceProfiles,
  extractAnswerFitness,
  type AnswerFitnessFeatures,
  type CitedSourceCrawler,
} from "@/lib/engines/geo-cited-source-features";
import { buildBrandGapDiff } from "@/lib/engines/geo-brand-gap-diff";
import { buildCitationFixPlan, type CitationFix } from "@/lib/engines/geo-citation-fix";
import type { FixTypeId } from "@/lib/engines/geo-fix-taxonomy";

export interface GeoFixReport {
  domain: string;
  brand: string;
  /** The answer engine this report targets (e.g. "openai"); omitted for the default single-engine run. */
  engine?: string;
  sampleSize: number;
  reliable: boolean;
  coverage: { cited: number; mentionedNotCited: number; absent: number; unanswered: number };
  competitorsBeatingYou: { domain: string; count: number }[];
  absentPrompts: { promptId: string; prompt: string; status: PromptCitationStatus }[];
  fixes: CitationFix[];
  fixesAvailable: boolean;
  note?: string;
  evidenceIds: string[];
}

export interface BuildGeoFixReportOptions {
  crawler?: CitedSourceCrawler;
  limit?: number;
  /** Learned per-fix-type weights (OPS-5) blended into recommendation ranking. */
  weights?: Record<FixTypeId, number>;
  /** Target a specific engine's probe results (FD-1); defaults to result.geo. */
  geo?: GeoResult;
  /** Engine label tagged onto the report (e.g. "openai"). */
  engine?: string;
}

export async function buildGeoFixReport(
  result: AnalyzeResult,
  opts: BuildGeoFixReportOptions = {},
): Promise<GeoFixReport> {
  const evidenceIds = (result.evidence ?? []).map((e) => e.id).slice(0, 6);
  const ledger = buildCitationLedger(opts.geo ?? result.geo, { evidenceIds });

  const absentPrompts = ledger.records
    .filter((r) => r.status === "absent" || r.status === "mentioned-not-cited")
    .map((r) => ({ promptId: r.promptId, prompt: r.prompt, status: r.status }));

  const base = {
    domain: result.project.domain,
    brand: result.project.brandGuess,
    engine: opts.engine,
    sampleSize: ledger.sampleSize,
    reliable: ledger.reliable,
    coverage: ledger.coverage,
    competitorsBeatingYou: ledger.competitorFrequency,
    absentPrompts,
    evidenceIds,
  };

  if (!opts.crawler) {
    return {
      ...base,
      fixes: [],
      fixesAvailable: false,
      note: "Fix recommendations require a live crawl of the cited sources — showing diagnosis only.",
    };
  }

  const profiles = await buildCitedSourceProfiles(ledger, { crawler: opts.crawler, limit: opts.limit });

  let brandFeatures: AnswerFitnessFeatures | null = null;
  try {
    const page = await opts.crawler.crawl(result.project.url);
    if (page.rawHtml && page.statusCode >= 200 && page.statusCode < 300) {
      brandFeatures = extractAnswerFitness(page.rawHtml);
    }
  } catch {
    brandFeatures = null;
  }

  if (!brandFeatures) {
    return {
      ...base,
      fixes: [],
      fixesAvailable: false,
      note: "Could not read your page to compare against the cited sources — showing diagnosis only.",
    };
  }

  const diff = buildBrandGapDiff(brandFeatures, profiles);
  const plan = buildCitationFixPlan(diff, {
    evidenceIds,
    sampleReliable: ledger.reliable,
    weights: opts.weights,
  });
  return { ...base, fixes: plan.fixes, fixesAvailable: true, note: plan.note };
}
