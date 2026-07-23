import type { AIVisibilityObservation, AIVisibilityPromptFamily, AIVisibilitySummary } from "@/lib/domain/types";


function domainsFor(observations: AIVisibilityObservation[]) {
  const counts: Record<string, number> = {};
  for (const observation of observations) {
    for (const citation of observation.citations) counts[citation.domain] = (counts[citation.domain] ?? 0) + 1;
  }
  return counts;
}

function competitorsFor(observations: AIVisibilityObservation[]) {
  const counts: Record<string, number> = {};
  for (const observation of observations) {
    for (const competitor of observation.competitorMentions) counts[competitor] = (counts[competitor] ?? 0) + 1;
  }
  return counts;
}

export function summarizeAIVisibility(
  families: AIVisibilityPromptFamily[],
  observations: AIVisibilityObservation[],
  brand: string,
): AIVisibilitySummary[] {
  return families.map((family) => {
    const familyObservations = observations.filter((observation) => observation.familyId === family.id);
    const sampleSize = familyObservations.length;
    const brandMentions = familyObservations.filter((observation) =>
      observation.brandMentions.some((mention) => mention.toLowerCase() === brand.toLowerCase()),
    ).length;
    const citedDomainFrequency = domainsFor(familyObservations);
    const competitorMentionFrequency = competitorsFor(familyObservations);
    const uniqueCitationSets = new Set(familyObservations.map((observation) => observation.citations.map((citation) => citation.domain).sort().join("|")));
    const sentimentDistribution = familyObservations.reduce<Record<string, number>>((counts, observation) => {
      counts[observation.sentiment] = (counts[observation.sentiment] ?? 0) + 1;
      return counts;
    }, {});
    const mentionRate = sampleSize ? Math.round((brandMentions / sampleSize) * 100) : 0;

    return {
      familyId: family.id,
      topic: family.topic,
      sampleSize,
      brandMentionFrequency: mentionRate,
      competitorMentionFrequency,
      citedDomainFrequency,
      citationStability: sampleSize ? Math.round(((sampleSize - uniqueCitationSets.size + 1) / sampleSize) * 100) : 0,
      answerConsistency: sampleSize ? Math.round((1 - Math.min(uniqueCitationSets.size - 1, sampleSize) / sampleSize) * 100) : 0,
      sentimentDistribution,
      evidenceIds: familyObservations.map((observation) => `ev-${observation.id}`),
      conclusion:
        mentionRate >= 50
          ? `${brand} appears in some observed answers, but citation patterns vary by prompt and platform.`
          : `Competitors are mentioned more consistently than ${brand} in this prompt family.`,
      recommendedAction: mentionRate >= 50 ? "Improve first-party pages so answers have clearer, citable service evidence." : "Create or strengthen a first-party page that directly answers this buying question before pursuing third-party mentions.",
    };
  });
}
