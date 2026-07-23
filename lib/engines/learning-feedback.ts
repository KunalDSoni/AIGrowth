/**
 * LEARN-001 / LEARN-009 — Feed outcome deltas into recommendation scoring.
 */

import type { AnalyzeDelta } from "@/lib/engines/analyze-delta";
import type { RankedCandidate } from "@/lib/engines/recommendation-bus";

/**
 * Boost unresolved actions that match worsened signals; soft-deprioritize
 * actions already marked resolved in the delta. Never claims causation.
 */
export function applyLearningFeedback(
  actions: RankedCandidate[],
  delta: AnalyzeDelta | null | undefined,
): RankedCandidate[] {
  if (!delta) return actions;

  const worsened = new Set(delta.metrics.filter((m) => m.direction !== "flat" && !m.improved).map((m) => m.key));
  const resolvedTitles = new Set(delta.actionsResolved.map((t) => t.toLowerCase()));

  const adjusted = actions.map((action) => {
    let multiplier = 1;
    if (resolvedTitles.has(action.title.toLowerCase())) multiplier *= 0.75;

    if (worsened.has("brandMentionRate") || worsened.has("firstPartyCitationShare")) {
      if (action.source === "ai-visibility" || action.source === "citation") multiplier *= 1.15;
    }
    if (worsened.has("critical") || worsened.has("high") || worsened.has("totalIssues") || worsened.has("seoScore")) {
      if (action.source === "technical") multiplier *= 1.15;
    }

    const priorityScore = Math.min(100, Math.round(action.priorityScore * multiplier));
    return {
      ...action,
      priorityScore,
      explanation:
        multiplier === 1
          ? action.explanation
          : `${action.explanation} Learning adjustment ×${multiplier.toFixed(2)} from prior-run delta (directional only).`,
    };
  });

  return adjusted
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((a, index) => ({ ...a, rank: index + 1 }));
}
