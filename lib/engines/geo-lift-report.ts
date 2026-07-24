/**
 * GIL-12 — Lift reporting surface (compose).
 *
 * Summarize the per-intervention lifts (GIL-11) into a presentable report:
 * before/after citation share per fix, confidence interval, honest label, and an
 * aggregate headline. A causal claim is only counted where GIL-11 labelled it
 * causal; nothing here upgrades a directional or insufficient result.
 */

import type { CitationLift, LiftLabel } from "@/lib/engines/geo-lift";
import type { AnswerFitnessFlag } from "@/lib/engines/geo-brand-gap-diff";
import type { MetricInterval } from "@/lib/metrics/types";

export interface LiftReportRow {
  fixId: string;
  feature: AnswerFitnessFlag;
  label: LiftLabel;
  baselineShare: number;
  postShare: number;
  deltaShare: number;
  postInterval: MetricInterval | null;
  note: string;
}

export interface LiftReport {
  rows: LiftReportRow[];
  summary: { total: number; causal: number; directional: number; insufficient: number; provenLifts: number };
  headline: string;
}

export function buildLiftReport(lifts: CitationLift[]): LiftReport {
  const rows: LiftReportRow[] = lifts.map((l) => ({
    fixId: l.fixId,
    feature: l.feature,
    label: l.label,
    baselineShare: l.baseline.citedShare,
    postShare: l.post.citedShare,
    deltaShare: l.deltaShare,
    postInterval: l.postInterval,
    note: l.note,
  }));

  const count = (label: LiftLabel) => rows.filter((r) => r.label === label).length;
  const summary = {
    total: rows.length,
    causal: count("causal"),
    directional: count("directional"),
    insufficient: count("insufficient"),
    provenLifts: count("causal"),
  };

  const headline = rows.length
    ? `${summary.causal} of ${summary.total} shipped fix(es) show a causal citation lift · ${summary.directional} directional · ${summary.insufficient} insufficient.`
    : "No shipped fixes have been measured yet.";

  return { rows, summary, headline };
}
