import type { BusinessProfileSnapshot, ContentOpportunity, WebsitePageProfile } from "@/lib/domain/types";
import { opportunityScore } from "@/lib/engines/priority";

export interface ContentGapCandidate {
  id: string;
  title: string;
  audience: string;
  targetService: string;
  intent: string;
  funnel: string;
  type: string;
  reason: string;
  cta: string;
  relatedPages: string[];
  relevance: number;
  conversion: number;
  authority: number;
  competition: number;
  effort: number;
  evidenceIds: string[];
}

function hasCoverage(candidate: ContentGapCandidate, pages: WebsitePageProfile[]) {
  const service = candidate.targetService.toLowerCase();
  const audience = candidate.audience.toLowerCase();
  return pages.some((page) => {
    const serviceMatch = page.services.some((value) => value.toLowerCase().includes(service) || service.includes(value.toLowerCase()));
    const audienceMatch = page.audiences.some((value) => audience.includes(value.toLowerCase()) || value.toLowerCase().includes(audience));
    return serviceMatch && audienceMatch;
  });
}

export function buildBusinessAwareContentOpportunities(input: {
  business: BusinessProfileSnapshot;
  pages: WebsitePageProfile[];
  candidates: ContentGapCandidate[];
}): ContentOpportunity[] {
  return input.candidates
    .filter((candidate) => !hasCoverage(candidate, input.pages))
    .map((candidate) => {
      const opportunity: ContentOpportunity = {
        ...candidate,
        scoreExplanation: "Ranked by business relevance, conversion fit, authority fit, competition, effort, and whether the current site already covers the service-audience pairing.",
        assumptions: [
          `${candidate.audience} remains a commercially relevant segment for ${input.business.name}.`,
          "The content will provide useful, specific guidance rather than a generic AI-written article.",
          "Search and competition values are directional demo estimates until providers are connected.",
        ],
        completionCriteria: [
          "Brief includes a clear reader problem, truthful service context, and a conversion path.",
          "Claims are verified before publication.",
          "The page links to at least two relevant commercial pages.",
        ],
        brief: {
          objective: `Help ${candidate.audience} make progress on a problem that can lead to ${input.business.goal.toLowerCase()}.`,
          angle: `Use ${input.business.name}'s ${input.business.industry.toLowerCase()} expertise in ${input.business.market} to make the topic practical, specific, and commercially useful.`,
          sections: [
            "Define the reader's situation and decision.",
            "Explain the accounting or bookkeeping issue in plain language.",
            "Show a practical Australian example or checklist.",
            "Address risks, tradeoffs, and common objections.",
            `Close with: ${candidate.cta}.`,
          ],
          factsToVerify: [
            "Any tax dates, compliance rules, or software claims.",
            `Any claim about ${input.business.name}'s process, credentials, or client results.`,
            "Any industry-specific operational detail.",
          ],
          internalLinks: candidate.relatedPages,
          measurementPlan: [
            "Record publish date.",
            "Track indexing and impressions once Search Console is connected.",
            "Track CTA clicks and assisted consultations from the content page.",
          ],
        },
      };
      return opportunity;
    })
    .sort((a, b) => opportunityScore(b) - opportunityScore(a));
}
