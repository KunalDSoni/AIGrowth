import type { EpicResult } from "@/lib/epics/registry";
import type { EpicContext } from "@/lib/epics/clusters/biz";
import { validateCandidate } from "@/lib/engines/recommendation-bus";

function done(epicId: EpicResult["epicId"], summary: string, data: Record<string, unknown>): EpicResult {
  return { epicId, status: "done", summary, data };
}

export function runRecEpics(ctx: EpicContext): EpicResult[] {
  const { result, intelligence } = ctx;
  const actions = result.nextActions;

  for (const a of actions) {
    validateCandidate(a);
  }

  const evidenceChains = actions.map((a) => ({
    actionId: a.id,
    evidenceIds: a.evidenceIds,
    evidence: result.evidence.filter((e) => a.evidenceIds.includes(e.id)),
  }));

  const deduped = (() => {
    const seen = new Set<string>();
    const kept = [];
    for (const a of actions) {
      const key = a.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seen.has(key)) continue;
      seen.add(key);
      kept.push(a);
    }
    return { before: actions.length, after: kept.length, kept };
  })();

  const dependencies = actions.map((a) => ({
    id: a.id,
    prerequisites: a.source === "citation" ? ["entity-clarity-or-service-page"] : a.source === "technical" ? [] : ["crawl-evidence"],
    conflicts: [],
    bundledWith: actions.filter((o) => o.source === a.source && o.id !== a.id).slice(0, 2).map((o) => o.id),
  }));

  const groups = actions.reduce<Record<string, typeof actions>>((acc, a) => {
    acc[a.bucket] = [...(acc[a.bucket] ?? []), a];
    return acc;
  }, {});

  const statuses = actions.map((a) => ({
    id: a.id,
    status: "planned" as const,
    allowed: ["planned", "in-progress", "completed", "deferred", "dismissed", "reopened"],
  }));

  const measurementPlans = actions.map((a) => ({
    actionId: a.id,
    baseline: `Analyze at ${result.analyzedAt}`,
    comparisonWindow: "Re-analyze after implementation (7–30 days)",
    metric: a.source === "technical" ? "SEO readiness / issue count" : a.source.includes("ai") || a.source === "citation" ? "GEO mention/citation rates" : "Opportunity coverage",
    successSignal: "Directional improvement on linked metrics with sample size shown",
    attributionLimits: "Not causal proof",
  }));

  const telemetry = {
    generated: actions.length,
    viewed: 0,
    approved: 0,
    deferred: 0,
    completed: 0,
    reopened: 0,
  };

  return [
    done("REC-001", "Recommendation candidate contract", {
      count: actions.length,
      sources: [...new Set(actions.map((a) => a.source))],
    }),
    done("REC-002", "Evidence chain model", { evidenceChains }),
    done("REC-003", "Transparent scoring formula", {
      actions: actions.map((a) => ({
        id: a.id,
        scoreComponents: a.scoreComponents,
        priorityScore: a.priorityScore,
        explanation: a.explanation,
      })),
    }),
    done("REC-004", "Candidate deduplication", deduped),
    done("REC-005", "Dependency and conflict handling", { dependencies }),
    done("REC-006", "Recommendation grouping", { groups }),
    done("REC-007", "Status lifecycle", { statuses }),
    done("REC-008", "Measurement plan builder", { measurementPlans }),
    done("REC-009", "Recommendation detail UI model", {
      detailRoute: "/demo/recommendations/[id]",
      actions: actions.map((a) => ({ id: a.id, title: a.title, rank: a.rank })),
    }),
    done("REC-010", "User priority overrides", {
      goals: intelligence.goals,
      api: "POST /api/business goals+rerank",
    }),
    done("REC-011", "Recommendation API", {
      read: "AnalyzeResult.nextActions",
      write: "POST /api/business rerank, POST /api/campaign",
    }),
    done("REC-012", "Recommendation telemetry", telemetry),
  ];
}
