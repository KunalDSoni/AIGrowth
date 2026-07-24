/**
 * GIL-ME-3 — Cross-engine ledger.
 *
 * Aggregate per-engine citation ledgers (GIL-01) into a cross-engine view: each
 * engine's coverage + state (covered / absent / unmeasured), the engines where
 * the brand is absent, the union of competitors that beat it and on which
 * engines, and pooled cross-engine share of voice. Pure.
 *
 * "Absent on engine X" is asserted only for engines that answered; an engine
 * with no answered sample is unmeasured, never counted as absence.
 */

import { buildCitationLedger } from "@/lib/engines/geo-citation-ledger";
import type { CitationLedger } from "@/lib/analyze/types";
import type { EngineGeoResult } from "@/lib/engines/geo-multi-engine";

export type EngineCitationState = "covered" | "absent" | "unmeasured";

export interface EngineCitationSummary {
  engine: string;
  measurement: EngineGeoResult["measurement"];
  state: EngineCitationState;
  sampleSize: number;
  reliable: boolean;
  citedShare: number;
  coverage: CitationLedger["coverage"];
  topCompetitors: { domain: string; count: number }[];
}

export interface CrossEngineCompetitor {
  domain: string;
  engines: string[];
  totalCount: number;
}

export interface CrossEngineLedger {
  engines: EngineCitationSummary[];
  enginesCovered: string[];
  enginesAbsent: string[];
  enginesUnmeasured: string[];
  competitorUnion: CrossEngineCompetitor[];
  overallCitedShare: number;
  reliable: boolean;
}

export function buildCrossEngineLedger(results: EngineGeoResult[]): CrossEngineLedger {
  const perEngine = results.map((r) => ({ result: r, ledger: buildCitationLedger(r.geo) }));

  const summaries: EngineCitationSummary[] = perEngine.map(({ result, ledger }) => {
    const state: EngineCitationState =
      ledger.coverage.cited > 0 ? "covered" : ledger.sampleSize > 0 ? "absent" : "unmeasured";
    const citedShare = ledger.sampleSize
      ? Math.round((ledger.coverage.cited / ledger.sampleSize) * 100) / 100
      : 0;
    return {
      engine: result.engine,
      measurement: result.measurement,
      state,
      sampleSize: ledger.sampleSize,
      reliable: ledger.reliable,
      citedShare,
      coverage: ledger.coverage,
      topCompetitors: ledger.competitorFrequency.slice(0, 5),
    };
  });

  const union = new Map<string, { engines: Set<string>; total: number }>();
  for (const { result, ledger } of perEngine) {
    for (const c of ledger.competitorFrequency) {
      const cur = union.get(c.domain) ?? { engines: new Set<string>(), total: 0 };
      cur.engines.add(result.engine);
      cur.total += c.count;
      union.set(c.domain, cur);
    }
  }
  const competitorUnion = [...union.entries()]
    .map(([domain, v]) => ({ domain, engines: [...v.engines].sort(), totalCount: v.total }))
    .sort((a, b) => b.totalCount - a.totalCount || a.domain.localeCompare(b.domain));

  const pooledAnswered = summaries.reduce((n, s) => n + s.sampleSize, 0);
  const pooledCited = summaries.reduce((n, s) => n + s.coverage.cited, 0);

  return {
    engines: summaries,
    enginesCovered: summaries.filter((s) => s.state === "covered").map((s) => s.engine),
    enginesAbsent: summaries.filter((s) => s.state === "absent").map((s) => s.engine),
    enginesUnmeasured: summaries.filter((s) => s.state === "unmeasured").map((s) => s.engine),
    competitorUnion,
    overallCitedShare: pooledAnswered ? Math.round((pooledCited / pooledAnswered) * 100) / 100 : 0,
    reliable: summaries.some((s) => s.reliable),
  };
}
