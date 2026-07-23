/**
 * AIV-003 — Mention, sentiment, and variability metrics from live GEO runs.
 */

import type { GeoObservation, GeoResult } from "@/lib/analyze/types";
import type { AnalyzeSnapshot } from "@/lib/engines/analyze-delta";

export type Sentiment = "positive" | "neutral" | "negative";

export interface GeoVariabilityMetrics {
  sampleSize: number;
  brandMentionRate: number;
  firstPartyCitationShare: number;
  competitorDomainRate: number;
  sentimentDistribution: Record<Sentiment, number>;
  /** Standard deviation of brand-mention binary across observations (0–50). */
  mentionVariance: number;
  /** Run-to-run brand mention rate variance when history exists. */
  runToRunMentionStdev: number | null;
  runCountCompared: number;
  confidence: "High" | "Medium" | "Low";
  labels: string[];
}

function sentimentOf(text: string, brandMentioned: boolean): Sentiment {
  const t = text.toLowerCase();
  if (/\b(scam|avoid|poor|worst|not recommend)\b/.test(t)) return "negative";
  if (brandMentioned && /\b(recommend|best|trusted|strong|leading)\b/.test(t)) return "positive";
  if (/\b(recommend|best|trusted)\b/.test(t)) return "positive";
  return "neutral";
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

export function computeGeoVariability(
  geo: GeoResult,
  history: AnalyzeSnapshot[] = [],
): GeoVariabilityMetrics {
  const observations = geo.observations.filter((o) => !o.error);
  const sampleSize = observations.length;
  const mentions = observations.map((o) => (o.brandMentioned ? 1 : 0));
  const brandMentionRate = sampleSize
    ? Math.round((mentions.reduce<number>((a, b) => a + b, 0) / sampleSize) * 100)
    : 0;

  const allCitations = observations.flatMap((o) => o.citations);
  const firstParty = allCitations.filter((c) => c.classification === "first-party").length;
  const other = allCitations.filter((c) => c.classification === "other").length;
  const firstPartyCitationShare = allCitations.length
    ? Math.round((firstParty / allCitations.length) * 100)
    : 0;
  const competitorDomainRate = allCitations.length ? Math.round((other / allCitations.length) * 100) : 0;

  const sentimentDistribution: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
  for (const obs of observations) {
    sentimentDistribution[sentimentOf(obs.rawResponse, obs.brandMentioned)] += 1;
  }

  const mentionVariance = stdev(mentions.map((m) => m * 100));

  const historyRates = [geo.brandMentionRate, ...history.map((h) => h.geo.brandMentionRate)].filter(
    (n) => typeof n === "number",
  );
  const runToRunMentionStdev = historyRates.length >= 2 ? stdev(historyRates) : null;

  let confidence: GeoVariabilityMetrics["confidence"] = "Low";
  if (sampleSize >= 8 && (runToRunMentionStdev === null || runToRunMentionStdev < 25)) confidence = "Medium";
  if (sampleSize >= 12 && historyRates.length >= 3 && (runToRunMentionStdev ?? 99) < 15) confidence = "High";

  const labels = [
    `Sample size n=${sampleSize}`,
    confidence === "Low" ? "Low confidence — treat as directional only" : `${confidence} confidence`,
  ];
  if (runToRunMentionStdev !== null) {
    labels.push(`Run-to-run mention stdev ${runToRunMentionStdev}pp across ${historyRates.length} runs`);
  }

  return {
    sampleSize,
    brandMentionRate,
    firstPartyCitationShare,
    competitorDomainRate,
    sentimentDistribution,
    mentionVariance,
    runToRunMentionStdev,
    runCountCompared: historyRates.length,
    confidence,
    labels,
  };
}

export function weakestPrompts(observations: GeoObservation[], limit = 3): GeoObservation[] {
  return [...observations]
    .filter((o) => !o.error && !o.brandMentioned)
    .slice(0, limit);
}
