import type { EpicResult } from "@/lib/epics/registry";
import type { EpicContext } from "@/lib/epics/clusters/biz";
import { applyLearningFeedback } from "@/lib/engines/learning-feedback";

function done(epicId: EpicResult["epicId"], summary: string, data: Record<string, unknown>): EpicResult {
  return { epicId, status: "done", summary, data };
}

export function runLearnEpics(ctx: EpicContext): EpicResult[] {
  const { result, delta, history } = ctx;

  const snapshot = {
    at: result.analyzedAt,
    seoScore: result.seo.site.score,
    issues: result.seo.site.totalIssues,
    brandMentionRate: result.geo.brandMentionRate,
    firstPartyCitationShare: result.geo.firstPartyCitationShare,
    sampleSize: result.geo.sampleSize,
  };

  const baseline = history[0]
    ? {
        at: history[0].analyzedAt,
        seoScore: history[0].seo.score,
        brandMentionRate: history[0].geo.brandMentionRate,
      }
    : null;

  const classification = (() => {
    if (!delta) return "awaiting-data" as const;
    const improved = delta.metrics.filter((m) => m.improved).length;
    const worsened = delta.metrics.filter((m) => m.direction !== "flat" && !m.improved).length;
    if (improved === 0 && worsened === 0) return "no-meaningful-change" as const;
    if (delta.confidence === "Low") return "insufficient-data" as const;
    if (improved > worsened) return "positive-signal" as const;
    if (worsened > improved) return "negative-signal" as const;
    return "confounded" as const;
  })();

  const learningRecord = {
    id: `learn-${result.project.domain}-${result.analyzedAt}`,
    classification,
    delta,
    attributionLimits: delta?.attributionLimits ?? "No prior run to compare.",
    followUp: delta?.followUp ?? "Re-analyze after shipping a Next action.",
  };

  const reprioritized = applyLearningFeedback(result.nextActions, delta);

  return [
    done("LEARN-001", "Metric snapshot contract", { snapshot }),
    done("LEARN-002", "Baseline window builder", { baseline, historyCount: history.length }),
    done("LEARN-003", "Implementation annotation", {
      annotations: delta?.actionsResolved.map((title) => ({
        what: title,
        when: delta.baselineAt,
        how: "Inferred from action disappearing between analyze runs — confirm manually",
      })) ?? [],
    }),
    done("LEARN-004", "Comparison window analysis", { delta }),
    done("LEARN-005", "External event annotation", {
      events: [],
      note: "Operators can annotate seasonality/outages in future UI; none stored yet",
    }),
    done("LEARN-006", "Outcome classification", { classification }),
    done("LEARN-007", "Attribution limitation explainer", {
      limits: learningRecord.attributionLimits,
      confidence: delta?.confidence ?? "Low",
    }),
    done("LEARN-008", "Learning record model", { learningRecord }),
    done("LEARN-009", "Reprioritization feedback", {
      before: result.nextActions.map((a) => ({ id: a.id, score: a.priorityScore })),
      after: reprioritized.map((a) => ({ id: a.id, score: a.priorityScore })),
    }),
    done("LEARN-010", "Outcome UI model", {
      route: "/demo/outcomes",
      summary: delta?.summary ?? "Run analyze twice to see outcomes",
      metrics: delta?.metrics ?? [],
    }),
  ];
}
