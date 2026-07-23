import type { OutcomeLearningRecord, Recommendation } from "@/lib/domain/types";

export interface OutcomeScenario {
  recommendationId: string;
  implementationDate: string;
  baselinePeriod: string;
  comparisonPeriod: string;
  baseline: Record<string, number>;
  comparison: Record<string, number>;
  externalEvents: string[];
}

const units: Record<string, string> = {
  impressions: "",
  clicks: "",
  ctr: "%",
  enquiries: "",
  ctaClicks: "",
};

export function buildOutcomeLearningRecords(recommendations: Recommendation[], scenarios: OutcomeScenario[]): OutcomeLearningRecord[] {
  return scenarios.flatMap((scenario) => {
    const recommendation = recommendations.find((item) => item.id === scenario.recommendationId);
    if (!recommendation) return [];
    const labels = Object.keys(scenario.baseline);
    const observedChanges = labels.map((label) => {
      const delta = Number(((scenario.comparison[label] ?? 0) - scenario.baseline[label]).toFixed(2));
      return { label, delta, unit: units[label] ?? "", direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat" } as const;
    });
    const positiveSignals = observedChanges.filter((change) => change.direction === "up").length;

    return [{
      id: `outcome-${scenario.recommendationId}`,
      recommendationId: scenario.recommendationId,
      recommendationTitle: recommendation.title,
      baselinePeriod: scenario.baselinePeriod,
      implementationDate: scenario.implementationDate,
      comparisonPeriod: scenario.comparisonPeriod,
      baselineMetrics: labels.map((label) => ({ label, value: scenario.baseline[label], unit: units[label] ?? "" })),
      comparisonMetrics: labels.map((label) => ({ label, value: scenario.comparison[label] ?? 0, unit: units[label] ?? "" })),
      observedChanges,
      externalEvents: scenario.externalEvents,
      attributionLimitations: "This is a directional comparison. Search changes can be affected by seasonality, SERP layout, ranking movement, offline campaigns and competitor activity.",
      outcomeConfidence: positiveSignals >= labels.length - 1 ? "Medium" : "Low",
      followUpAction: positiveSignals >= labels.length - 1 ? "Keep the change and look for the next bottleneck in the same journey." : "Wait for a larger sample or pair the change with a stronger supporting action before drawing conclusions.",
    }];
  });
}
