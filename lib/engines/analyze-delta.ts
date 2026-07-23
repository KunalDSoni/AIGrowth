import type { AnalyzeResult } from "@/lib/analyze/types";

/** Slim snapshot kept for outcome deltas (full HTML/GEO text lives only on latest). */
export interface AnalyzeSnapshot {
  analyzedAt: string;
  brandGuess: string;
  domain: string;
  seo: {
    score: number;
    band: string;
    pagesScanned: number;
    totalIssues: number;
    critical: number;
    high: number;
    quickWins: number;
  };
  geo: {
    runId: string;
    model: string;
    sampleSize: number;
    brandMentionRate: number;
    firstPartyCitationShare: number;
  };
  nextActionIds: string[];
  topActionTitles: string[];
}

export function toSnapshot(result: AnalyzeResult): AnalyzeSnapshot {
  return {
    analyzedAt: result.analyzedAt,
    brandGuess: result.project.brandGuess,
    domain: result.project.domain,
    seo: {
      score: result.seo.site.score,
      band: result.seo.site.band,
      pagesScanned: result.seo.site.pagesScanned,
      totalIssues: result.seo.site.totalIssues,
      critical: result.seo.site.critical,
      high: result.seo.site.high,
      quickWins: result.seo.site.quickWins,
    },
    geo: {
      runId: result.geo.runId,
      model: result.geo.model,
      sampleSize: result.geo.sampleSize,
      brandMentionRate: result.geo.brandMentionRate,
      firstPartyCitationShare: result.geo.firstPartyCitationShare,
    },
    nextActionIds: result.nextActions.map((a) => a.id),
    topActionTitles: result.nextActions.slice(0, 5).map((a) => a.title),
  };
}

export type MetricDirection = "up" | "down" | "flat";

export interface DeltaMetric {
  key: string;
  label: string;
  before: number;
  after: number;
  delta: number;
  unit: string;
  direction: MetricDirection;
  /** For scores/rates, up is usually better; for issues, down is better. */
  improved: boolean;
  higherIsBetter: boolean;
}

export interface AnalyzeDelta {
  baselineAt: string;
  comparisonAt: string;
  brandGuess: string;
  domain: string;
  metrics: DeltaMetric[];
  actionsResolved: string[];
  actionsNew: string[];
  summary: string;
  confidence: "Low" | "Medium";
  attributionLimits: string;
  followUp: string;
}

function direction(delta: number): MetricDirection {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

function metric(
  key: string,
  label: string,
  before: number,
  after: number,
  unit: string,
  higherIsBetter: boolean,
): DeltaMetric {
  const delta = Number((after - before).toFixed(2));
  const dir = direction(delta);
  const improved = dir === "flat" ? false : higherIsBetter ? dir === "up" : dir === "down";
  return { key, label, before, after, delta, unit, direction: dir, improved, higherIsBetter };
}

/**
 * Compare two analyze snapshots into an honest outcome delta.
 * Does not claim causation — only directional change between runs.
 */
export function compareAnalyzeSnapshots(baseline: AnalyzeSnapshot, current: AnalyzeSnapshot): AnalyzeDelta {
  const metrics: DeltaMetric[] = [
    metric("seoScore", "SEO readiness", baseline.seo.score, current.seo.score, "/100", true),
    metric("pagesScanned", "Pages scanned", baseline.seo.pagesScanned, current.seo.pagesScanned, "", true),
    metric("totalIssues", "Total SEO issues", baseline.seo.totalIssues, current.seo.totalIssues, "", false),
    metric("critical", "Critical issues", baseline.seo.critical, current.seo.critical, "", false),
    metric("high", "High issues", baseline.seo.high, current.seo.high, "", false),
    metric("brandMentionRate", "GEO brand mention rate", baseline.geo.brandMentionRate, current.geo.brandMentionRate, "%", true),
    metric(
      "firstPartyCitationShare",
      "First-party citation share",
      baseline.geo.firstPartyCitationShare,
      current.geo.firstPartyCitationShare,
      "%",
      true,
    ),
    metric("geoSampleSize", "GEO sample size", baseline.geo.sampleSize, current.geo.sampleSize, "", true),
  ];

  const beforeIds = new Set(baseline.nextActionIds);
  const afterIds = new Set(current.nextActionIds);
  const actionsResolved = baseline.topActionTitles.filter((_, i) => {
    const id = baseline.nextActionIds[i];
    return id ? !afterIds.has(id) : false;
  });
  // Prefer id-based resolved/new
  const resolvedIds = [...beforeIds].filter((id) => !afterIds.has(id));
  const newIds = [...afterIds].filter((id) => !beforeIds.has(id));
  const actionsResolvedTitles = baseline.nextActionIds
    .map((id, i) => (resolvedIds.includes(id) ? baseline.topActionTitles[i] ?? id : null))
    .filter((t): t is string => Boolean(t));
  const actionsNewTitles = current.nextActionIds
    .map((id, i) => (newIds.includes(id) ? current.topActionTitles[i] ?? id : null))
    .filter((t): t is string => Boolean(t));

  const improvedCount = metrics.filter((m) => m.improved).length;
  const worsenedCount = metrics.filter((m) => m.direction !== "flat" && !m.improved).length;

  let summary: string;
  if (improvedCount === 0 && worsenedCount === 0) {
    summary = "No material change between runs on the tracked SEO/GEO signals.";
  } else if (improvedCount > worsenedCount) {
    summary = `${improvedCount} signal(s) improved and ${worsenedCount} worsened since the prior analyze. Directional only — not proof of causation.`;
  } else if (worsenedCount > improvedCount) {
    summary = `${worsenedCount} signal(s) worsened and ${improvedCount} improved since the prior analyze. Re-check recent site or prompt changes.`;
  } else {
    summary = `Mixed movement: ${improvedCount} improved, ${worsenedCount} worsened. Treat as a learning signal, not a verdict.`;
  }

  const confidence: "Low" | "Medium" =
    current.geo.sampleSize >= 5 && baseline.geo.sampleSize >= 5 && improvedCount + worsenedCount >= 2
      ? "Medium"
      : "Low";

  return {
    baselineAt: baseline.analyzedAt,
    comparisonAt: current.analyzedAt,
    brandGuess: current.brandGuess,
    domain: current.domain,
    metrics,
    actionsResolved: actionsResolvedTitles.length ? actionsResolvedTitles : actionsResolved,
    actionsNew: actionsNewTitles,
    summary,
    confidence,
    attributionLimits:
      "Search and AI answers vary by seasonality, model updates, prompt wording, SERP layout, and competitor activity. This delta compares two OpenGrowth runs only.",
    followUp:
      improvedCount > worsenedCount
        ? "Keep changes that likely contributed, then tackle the highest remaining Next action."
        : "Ship one evidence-backed fix from Next actions, then re-analyze to learn again.",
  };
}
