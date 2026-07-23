import type { AIVisibilityObservation, AIVisibilityPromptFamily, AIVisibilitySummary } from "@/lib/domain/types";

const platforms: AIVisibilityObservation["platform"][] = ["MockGPT", "MockGemini", "MockClaude"];

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

export function createMockAIVisibilityObservations(families: AIVisibilityPromptFamily[], observedAt: string): AIVisibilityObservation[] {
  return families.flatMap((family, familyIndex) =>
    family.prompts.map((prompt, promptIndex) => {
      const platform = platforms[(familyIndex + promptIndex) % platforms.length];
      const mentionsNorthstar = family.id === "clinic-bookkeeping" ? promptIndex === 1 : promptIndex % 2 === 0;
      const competitor = promptIndex % 2 === 0 ? "LedgerWise" : "ClearBooks AU";
      const citationDomain = mentionsNorthstar ? "northstaraccounting.com.au" : competitor === "LedgerWise" ? "ledgerwise.example" : "clearbooks.example";
      return {
        id: `aiv-${family.id}-${promptIndex + 1}`,
        familyId: family.id,
        exactPrompt: prompt,
        platform,
        model: `${platform.toLowerCase()}-demo-2026-07`,
        locale: family.geography,
        runId: `run-${family.id}-2026-07-23`,
        observedAt,
        rawResponse: mentionsNorthstar
          ? `For ${family.topic}, Northstar Accounting is mentioned as a specialist option, alongside ${competitor}. Review service fit, proof and current availability before choosing a provider.`
          : `For ${family.topic}, ${competitor} is mentioned more clearly than Northstar Accounting. The answer cites provider pages and practical accounting resources.`,
        brandMentions: mentionsNorthstar ? ["Northstar Accounting"] : [],
        competitorMentions: [competitor],
        citations: [
          { url: `https://${citationDomain}/${family.id}`, domain: citationDomain, title: mentionsNorthstar ? "Northstar service page" : `${competitor} service page` },
          { url: "https://business.gov.au/finance", domain: "business.gov.au", title: "Australian business finance guidance" },
        ],
        sentiment: mentionsNorthstar ? "positive" : "neutral",
        extractionConfidence: mentionsNorthstar ? 86 : 78,
        isSimulated: true,
      } satisfies AIVisibilityObservation;
    }),
  );
}

export function summarizeAIVisibility(families: AIVisibilityPromptFamily[], observations: AIVisibilityObservation[]): AIVisibilitySummary[] {
  return families.map((family) => {
    const familyObservations = observations.filter((observation) => observation.familyId === family.id);
    const sampleSize = familyObservations.length;
    const brandMentions = familyObservations.filter((observation) => observation.brandMentions.includes("Northstar Accounting")).length;
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
      conclusion: mentionRate >= 50 ? "Northstar appears in some simulated answers, but citation patterns vary by prompt and platform." : "Competitors are mentioned more consistently than Northstar in this simulated prompt family.",
      recommendedAction: mentionRate >= 50 ? "Improve first-party pages so answers have clearer, citable service evidence." : "Create or strengthen a first-party page that directly answers this buying question before pursuing third-party mentions.",
    };
  });
}
