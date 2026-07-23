import type { EpicResult } from "@/lib/epics/registry";
import type { EpicContext } from "@/lib/epics/clusters/biz";
import { computeGeoVariability, weakestPrompts } from "@/lib/engines/geo-metrics";

function done(epicId: EpicResult["epicId"], summary: string, data: Record<string, unknown>): EpicResult {
  return { epicId, status: "done", summary, data };
}

export function runAivEpics(ctx: EpicContext): EpicResult[] {
  const { result, intelligence, history } = ctx;
  const geo = result.geo;
  const metrics = intelligence.geoMetrics ?? computeGeoVariability(geo, history);
  const variants = intelligence.promptVariants;
  const family = {
    id: "live-primary",
    topic: intelligence.profile.services[0] ?? result.project.brandGuess,
    prompts: geo.observations.map((o) => o.prompt),
    variants: variants.map((v) => ({ id: v.id, dimension: v.dimension, text: v.text })),
  };

  const providerContract = {
    provider: "gemini",
    model: geo.model,
    capabilities: ["answer", "citations-extract", "mention-extract"],
    mockSupported: true,
  };

  const lifecycle = {
    runId: geo.runId,
    status: geo.errors.length && geo.sampleSize === 0 ? "failed" : "completed",
    sampleSize: geo.sampleSize,
    errors: geo.errors,
    cost: geo.cost,
  };

  const rawStorage = geo.observations.map((o) => ({
    id: o.id,
    prompt: o.prompt,
    rawResponse: o.rawResponse.slice(0, 500),
    storedAt: result.analyzedAt,
    platform: "Gemini",
    model: geo.model,
  }));

  const mentions = geo.observations.map((o) => ({
    id: o.id,
    brandMentioned: o.brandMentioned,
    brand: result.project.brandGuess,
  }));

  const citations = geo.observations.flatMap((o) =>
    o.citations.map((c) => ({ observationId: o.id, ...c })),
  );

  const prominence = geo.observations.map((o) => ({
    id: o.id,
    prominence: o.brandMentioned ? (o.rawResponse.toLowerCase().indexOf(result.project.brandGuess.toLowerCase()) < 120 ? "high" : "medium") : "absent",
  }));

  const gaps = {
    weakPrompts: weakestPrompts(geo.observations),
    brandMentionRate: geo.brandMentionRate,
    firstPartyCitationShare: geo.firstPartyCitationShare,
  };

  const recBridge = result.nextActions.filter((a) => a.source === "ai-visibility" || a.source === "citation");

  return [
    done("AIV-001", "Prompt family model", family),
    done("AIV-002", "Prompt variant generator", { variants }),
    done("AIV-003", "AI platform provider contract", providerContract),
    done("AIV-004", "Observation run lifecycle", lifecycle),
    done("AIV-005", "Raw answer storage", { answers: rawStorage }),
    done("AIV-006", "Mention extraction", { mentions, rate: geo.brandMentionRate }),
    done("AIV-007", "Citation extraction", { citations }),
    done("AIV-008", "Sentiment and prominence signals", {
      sentiment: metrics.sentimentDistribution,
      prominence,
    }),
    done("AIV-009", "Variability and sample size metrics", { metrics }),
    done("AIV-010", "AI visibility evidence UI model", {
      sampleSize: geo.sampleSize,
      labels: metrics.labels,
      guardrails: result.guardrails,
    }),
    done("AIV-011", "AI visibility gap detection", gaps),
    done("AIV-012", "AI visibility recommendation bridge", { actions: recBridge }),
  ];
}
