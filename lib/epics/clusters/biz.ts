import type { AnalyzeResult } from "@/lib/analyze/types";
import type { AnalyzeDelta, AnalyzeSnapshot } from "@/lib/engines/analyze-delta";
import type { LiveIntelligence } from "@/lib/engines/live-intelligence";
import type { EpicResult } from "@/lib/epics/registry";
import { pendingReview, rankedEntities } from "@/lib/engines/business-graph";

export interface EpicContext {
  result: AnalyzeResult;
  intelligence: LiveIntelligence;
  history: AnalyzeSnapshot[];
  delta: AnalyzeDelta | null;
}

function done(epicId: EpicResult["epicId"], summary: string, data: Record<string, unknown>): EpicResult {
  return { epicId, status: "done", summary, data };
}

export function runBizEpics(ctx: EpicContext): EpicResult[] {
  const { intelligence: intel, result } = ctx;
  const profile = intel.profile;
  const graph = intel.graph;

  const trustSignals = result.seo.pages
    .filter((p) => p.ok)
    .flatMap((p) => {
      const title = (p.title ?? "").toLowerCase();
      const hits: string[] = [];
      if (/case study|testimonial|review|certified|accredited|guarantee/.test(title)) hits.push(p.title ?? p.finalUrl);
      return hits;
    });

  const differentiators =
    profile.differentiators.length > 0
      ? profile.differentiators
      : [`Observed brand: ${profile.name}`, `Domain authority surface: ${result.project.domain}`];

  const voiceRules = {
    tone: profile.tone,
    vocabularyInclude: profile.services.slice(0, 5),
    vocabularyExclude: ["guaranteed #1", "world's best", "risk-free ranking"],
    complianceNotes: ["Do not fabricate clients, awards, or statistics."],
    examples: [`Write clearly about ${profile.services[0] ?? "services"} for ${profile.audienceSegments[0] ?? "buyers"}.`],
  };

  const contextApi = {
    businessId: profile.id,
    name: profile.name,
    market: profile.market,
    industry: profile.industry,
    goal: profile.goal,
    services: profile.services,
    audiences: profile.audienceSegments,
    goals: intel.goals,
    entityCounts: {
      service: rankedEntities(graph, "service").length,
      audience: rankedEntities(graph, "audience").length,
      geography: rankedEntities(graph, "geography").length,
      competitor: rankedEntities(graph, "competitor").length,
    },
  };

  return [
    done("BIZ-001", "Business profile foundation", { profile }),
    done("BIZ-002", "Service and product catalogue", { services: profile.services, priority: intel.goals.primary }),
    done("BIZ-003", "Audience segment model", { audiences: profile.audienceSegments }),
    done("BIZ-004", "Geographic market model", { market: profile.market, geographies: rankedEntities(graph, "geography") }),
    done("BIZ-005", "Trust signal inventory", { trustSignals, count: trustSignals.length }),
    done("BIZ-006", "Differentiator analysis", { differentiators, weakClaims: voiceRules.vocabularyExclude }),
    done("BIZ-007", "Website-informed business inference", {
      inferredServices: profile.services,
      brandGuess: result.project.brandGuess,
      labeledAs: "ai-inferred-or-observed",
    }),
    done("BIZ-008", "Assumption review workflow", { pending: pendingReview(graph), confirmations: intel.pendingReview.length }),
    done("BIZ-009", "Entity graph foundation", { entities: graph.entities.length, relationships: graph.relationships.length }),
    done("BIZ-010", "Business priority weighting", { goals: intel.goals }),
    done("BIZ-011", "Brand voice rules", voiceRules),
    done("BIZ-012", "Business context API read model", contextApi),
  ];
}
