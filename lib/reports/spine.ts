/** Assembles the shared AnalysisSpine that all three report builders read. */

import type { AnalyzeResult } from "@/lib/analyze/types";
import { domainKey, getProjectStore } from "@/lib/projects/store";
import { loadWorkspace, type MarketingWorkspace } from "@/lib/marketing/workspace";
import type { SectionStatus } from "@/lib/reports/types";

/** GEO rates below this sample size are directional only. */
export const GEO_MIN_SAMPLE = 10;

export interface SpineSection<T> {
  status: SectionStatus;
  data: T | null;
}

export interface AnalysisSpine {
  domain: string;
  brand: string;
  generatedAt: string;
  seo: SpineSection<AnalyzeResult["seo"]>;
  geo: SpineSection<AnalyzeResult["geo"]>;
  marketing: SpineSection<MarketingWorkspace>;
}

export function statusForSeo(analyze: AnalyzeResult | null): SectionStatus {
  if (!analyze?.seo?.site) return "not_run";
  if ((analyze.seo.pages?.length ?? 0) === 0) return "insufficient";
  return "ready";
}

export function statusForGeo(analyze: AnalyzeResult | null): SectionStatus {
  if (!analyze?.geo) return "not_run";
  if ((analyze.geo.sampleSize ?? 0) < GEO_MIN_SAMPLE) return "insufficient";
  return "ready";
}

export function statusForMarketing(ws: MarketingWorkspace | null): SectionStatus {
  if (!ws?.report) return "not_run";
  return "ready";
}

export function assembleSpineFrom(
  domain: string,
  analyze: AnalyzeResult | null,
  ws: MarketingWorkspace | null,
): AnalysisSpine {
  const key = domainKey(domain);
  const brand = analyze?.project.brandGuess ?? ws?.brand ?? key;
  return {
    domain: key,
    brand,
    generatedAt: new Date().toISOString(),
    seo: { status: statusForSeo(analyze), data: analyze?.seo ?? null },
    geo: { status: statusForGeo(analyze), data: analyze?.geo ?? null },
    marketing: { status: statusForMarketing(ws), data: ws ?? null },
  };
}

export async function assembleSpine(domain: string): Promise<AnalysisSpine> {
  const analyze = await getProjectStore().loadLatest(domainKey(domain));
  const ws = await loadWorkspace(domain);
  return assembleSpineFrom(domain, analyze, ws);
}
