/**
 * Citation gap builder — live GEO path (CITE-002).
 * Demo/Northstar path remains only for legacy unit fixtures via buildCitationGapActionsFromSummaries.
 */

import type { AIVisibilityObservation, AIVisibilitySummary, CitationGapAction } from "@/lib/domain/types";
import { buildLiveCitationGaps } from "@/lib/engines/live-citation-gaps";
import type { GeoResult } from "@/lib/analyze/types";

export { buildLiveCitationGaps };

/** @deprecated Prefer buildLiveCitationGaps for product paths. */
export function buildCitationGapActions(input: {
  summaries: AIVisibilitySummary[];
  observations: AIVisibilityObservation[];
  firstPartyDomain: string;
  competitors: string[];
  brand?: string;
}): CitationGapAction[] {
  const brand = input.brand ?? input.firstPartyDomain.split(".")[0] ?? "Brand";
  // Convert summaries into a minimal GeoResult-shaped signal for the live builder.
  const geo: GeoResult = {
    runId: "legacy-summary",
    model: "legacy",
    sampleSize: input.observations.length,
    brandMentionRate: input.summaries[0]?.brandMentionFrequency ?? 0,
    firstPartyCitationShare: input.summaries.some((s) =>
      Object.keys(s.citedDomainFrequency).some((d) => d.includes(input.firstPartyDomain.replace(/^www\./, ""))),
    )
      ? 50
      : 0,
    observations: input.observations.map((o) => ({
      id: o.id,
      prompt: o.exactPrompt,
      rawResponse: o.rawResponse,
      brandMentioned: o.brandMentions.length > 0,
      citations: o.citations.map((c) => ({
        url: c.url,
        domain: c.domain,
        classification: c.domain.includes(input.firstPartyDomain.replace(/^www\./, ""))
          ? ("first-party" as const)
          : ("other" as const),
      })),
    })),
    errors: [],
    cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 },
  };

  return buildLiveCitationGaps({
    geo,
    brand,
    domain: input.firstPartyDomain,
    evidenceIds: input.summaries.flatMap((s) => s.evidenceIds).slice(0, 4),
  });
}
