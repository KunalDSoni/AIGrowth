/**
 * CITE-002 — Citation gap → action from live GEO (no demo brand names).
 */

import type { GeoResult } from "@/lib/analyze/types";
import type { CitationGapAction } from "@/lib/domain/types";

const MIN_SAMPLE = 3;

export function buildLiveCitationGaps(input: {
  geo: GeoResult;
  brand: string;
  domain: string;
  evidenceIds: string[];
}): CitationGapAction[] {
  const { geo, brand, domain, evidenceIds } = input;
  if (geo.sampleSize < MIN_SAMPLE) return [];

  const otherDomains = [
    ...new Set(
      geo.observations.flatMap((o) =>
        o.citations.filter((c) => c.classification === "other").map((c) => c.domain),
      ),
    ),
  ];

  const actions: CitationGapAction[] = [];

  if (geo.firstPartyCitationShare === 0 && otherDomains.length > 0) {
    actions.push({
      id: "citation-gap-first-party-absent",
      familyId: "live-geo",
      title: `Create a citable first-party source for ${brand}`,
      gapType: "first-party-page",
      explanation: `Across ${geo.sampleSize} live AI answers, ${domain} was never cited while ${otherDomains.slice(0, 3).join(", ")} appeared.`,
      recommendedAction:
        "Publish a clear, factual service/FAQ page that answers the same buyer questions with verifiable details AI systems can cite.",
      evidenceIds,
      citedDomains: otherDomains,
      missingFirstPartyCitation: true,
      competitorCitations: otherDomains,
      assumptions: [
        "Live model answers are directional samples, not stable rankings.",
        "A citable page must help users first; do not create content only to influence AI answers.",
      ],
      measurementPlan: [
        "Record publish/update date.",
        "Repeat the same prompt family across the same platforms.",
        "Compare first-party citation share and brand mention rate.",
      ],
      confidence: geo.sampleSize >= 6 ? "Medium" : "Low",
    });
  }

  const weakMentions = geo.observations.filter((o) => !o.error && !o.brandMentioned);
  if (geo.brandMentionRate < 50 && weakMentions.length >= 2) {
    actions.push({
      id: "citation-gap-brand-absent",
      familyId: "live-geo",
      title: `Strengthen entity clarity so AI answers can name ${brand}`,
      gapType: "source-strengthening",
      explanation: `${brand} was mentioned in only ${geo.brandMentionRate}% of ${geo.sampleSize} probes.`,
      recommendedAction:
        "Improve homepage/about/service entity clarity (consistent brand name, services, geography) with proof users can verify.",
      evidenceIds,
      citedDomains: otherDomains,
      missingFirstPartyCitation: geo.firstPartyCitationShare === 0,
      competitorCitations: otherDomains,
      assumptions: [
        "Absence in a small sample does not prove permanent invisibility.",
        "Do not fabricate awards, clients, or statistics.",
      ],
      measurementPlan: [
        "Ship entity clarity updates.",
        "Repeat the same prompt family across the same platforms.",
        "Track mention rate with sample size shown.",
      ],
      confidence: geo.sampleSize >= 6 ? "Medium" : "Low",
    });
  }

  return actions;
}
