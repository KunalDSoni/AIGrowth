import type { AIVisibilityObservation, AIVisibilitySummary, CitationGapAction } from "@/lib/domain/types";

export function buildCitationGapActions(input: {
  summaries: AIVisibilitySummary[];
  observations: AIVisibilityObservation[];
  firstPartyDomain: string;
  competitors: string[];
}): CitationGapAction[] {
  return input.summaries
    .flatMap((summary) => {
      const observations = input.observations.filter((observation) => observation.familyId === summary.familyId);
      const citedDomains = Object.keys(summary.citedDomainFrequency);
      const missingFirstPartyCitation = !citedDomains.includes(input.firstPartyDomain);
      const competitorCitations = citedDomains.filter((domain) => input.competitors.some((competitor) => domain.includes(competitor.toLowerCase().replaceAll(" ", ""))));
      const noBrandMentionMajority = summary.brandMentionFrequency < 50;
      if (!missingFirstPartyCitation && !noBrandMentionMajority && competitorCitations.length === 0) return [];

      const gapType: CitationGapAction["gapType"] = missingFirstPartyCitation ? "first-party-page" : competitorCitations.length ? "source-strengthening" : "third-party-source";
      const action: CitationGapAction = {
        id: `citation-gap-${summary.familyId}`,
        familyId: summary.familyId,
        title: missingFirstPartyCitation ? `Create a citable source for ${summary.topic}` : `Strengthen Northstar's cited source for ${summary.topic}`,
        gapType,
        explanation: missingFirstPartyCitation
          ? "Simulated AI answers cite other domains but do not cite Northstar for this prompt family."
          : "Northstar appears in some answers, but competitors or public sources are cited more consistently.",
        recommendedAction: missingFirstPartyCitation
          ? "Create or improve a first-party page that directly answers the prompt family with useful, verifiable information and clear service relevance."
          : "Improve the existing source page with clearer facts, internal links, and visible proof that can be cited truthfully.",
        evidenceIds: summary.evidenceIds,
        citedDomains,
        missingFirstPartyCitation,
        competitorCitations,
        assumptions: [
          "The simulated observations are directional and should be repeated with a real provider before major investment.",
          "A citable page must help users first; it should not be created only to influence AI answers.",
          "Structured data should only describe visible, truthful page information.",
        ],
        measurementPlan: [
          "Record the page improvement or publish date.",
          "Repeat the same prompt family across the same platforms.",
          "Compare brand mention frequency, first-party citation frequency, and citation stability.",
        ],
        confidence: observations.length >= 3 ? "Medium" : "Low",
      };
      return [action];
    });
}
