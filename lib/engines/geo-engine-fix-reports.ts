/**
 * GIL-FD-2 — Per-engine fix reports.
 *
 * Produce one engine-tagged fix report per engine where the brand actually has a
 * gap — an answered sample and at least one competitor cited instead. Reuses the
 * engine-aware buildGeoFixReport (FD-1) against each engine's probe results, so a
 * fix targets what beats you on that specific engine. Pure orchestration; the
 * caller supplies the per-engine results and (optionally) a crawler.
 */

import type { AnalyzeResult } from "@/lib/analyze/types";
import type { EngineGeoResult } from "@/lib/engines/geo-multi-engine";
import { buildCitationLedger } from "@/lib/engines/geo-citation-ledger";
import {
  buildGeoFixReport,
  type BuildGeoFixReportOptions,
  type GeoFixReport,
} from "@/lib/engines/geo-fix-report";

export async function buildEngineFixReports(
  result: AnalyzeResult,
  engineResults: EngineGeoResult[],
  opts: Omit<BuildGeoFixReportOptions, "geo" | "engine"> = {},
): Promise<GeoFixReport[]> {
  const reports: GeoFixReport[] = [];
  for (const er of engineResults) {
    const ledger = buildCitationLedger(er.geo);
    // Worth a fix report only where there is a gap to close on this engine.
    if (ledger.sampleSize === 0 || ledger.competitorFrequency.length === 0) continue;
    reports.push(await buildGeoFixReport(result, { ...opts, geo: er.geo, engine: er.engine }));
  }
  return reports;
}
