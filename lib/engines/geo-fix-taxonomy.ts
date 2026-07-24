/**
 * GIL-04 — Fix-type taxonomy & registry.
 *
 * The single documented source of truth mapping each answer-fitness gap flag
 * (GIL-03) to a specific answer-optimized fix type. Mirrors
 * `scoring-constants.ts`: every value carries a written rationale so the
 * recommender (GIL-05) never hard-codes copy or priority.
 *
 * `baseImpact` is a documented directional *prior* for default ranking — it is
 * superseded by measured learned weights in GIL-15 and is never a measured lift.
 * `description` is generic/imperative and invents no company specifics; the crew
 * fills specifics later under claim-check (GIL-08).
 */

import type { AnswerFitnessFlag } from "@/lib/engines/geo-brand-gap-diff";

export type FixTypeId =
  | "direct-answer"
  | "faq-block"
  | "comparison-page"
  | "pricing-page"
  | "freshness-refresh"
  | "structured-data"
  | "proof-block";

export type FixAssetType = "page" | "section" | "markup";
export type FixEffort = "low" | "medium" | "high";

export interface FixTypeDef {
  id: FixTypeId;
  addresses: AnswerFitnessFlag;
  label: string;
  assetType: FixAssetType;
  effort: FixEffort;
  baseImpact: number;
  description: string;
  rationale: string;
}

export const FIX_TAXONOMY_VERSION = 1;

export const FIX_TYPES: Record<AnswerFitnessFlag, FixTypeDef> = {
  hasDirectAnswer: {
    id: "direct-answer",
    addresses: "hasDirectAnswer",
    label: "Add a direct answer lead",
    assetType: "section",
    effort: "low",
    baseImpact: 5,
    description:
      "Add a concise definitional lead paragraph that answers the buyer question in the first two sentences.",
    rationale: "Answer engines quote a concise definitional lead; with none present there is nothing to lift.",
  },
  hasFaqStructure: {
    id: "faq-block",
    addresses: "hasFaqStructure",
    label: "Add an FAQ block",
    assetType: "section",
    effort: "low",
    baseImpact: 4,
    description:
      "Add a question-and-answer FAQ block covering the real buyer questions, each answer self-contained.",
    rationale: "FAQ Q&A blocks map directly to the buyer questions answer engines respond to.",
  },
  hasComparisonContent: {
    id: "comparison-page",
    addresses: "hasComparisonContent",
    label: "Publish a comparison page",
    assetType: "page",
    effort: "medium",
    baseImpact: 4,
    description:
      "Publish an honest comparison page (options, criteria, trade-offs) for the decision the buyer is making.",
    rationale: "Comparison pages are preferentially cited for shortlist and decision prompts.",
  },
  hasStructuredPricing: {
    id: "pricing-page",
    addresses: "hasStructuredPricing",
    label: "State pricing clearly",
    assetType: "page",
    effort: "medium",
    baseImpact: 3,
    description:
      "State concrete pricing signals (tiers, ranges, or 'from' prices) with what each includes, factually.",
    rationale: "Answer engines cite sources that state concrete pricing rather than hide it.",
  },
  hasFreshnessSignal: {
    id: "freshness-refresh",
    addresses: "hasFreshnessSignal",
    label: "Add and surface freshness",
    assetType: "markup",
    effort: "low",
    baseImpact: 2,
    description:
      "Review the content, correct anything stale, and surface a visible and structured last-updated date.",
    rationale: "Recency signals raise trust and the likelihood a source is cited.",
  },
  hasStructuredData: {
    id: "structured-data",
    addresses: "hasStructuredData",
    label: "Add structured data",
    assetType: "markup",
    effort: "low",
    baseImpact: 3,
    description:
      "Add valid JSON-LD schema (Organization/Service/FAQ as appropriate) describing the verifiable facts on the page.",
    rationale: "Machine-readable schema makes the page's facts extractable and therefore citable.",
  },
  hasProofSignal: {
    id: "proof-block",
    addresses: "hasProofSignal",
    label: "Add a proof block",
    assetType: "section",
    effort: "medium",
    baseImpact: 3,
    description:
      "Add a proof block with verifiable evidence (named case studies, certifications, or real testimonials).",
    rationale: "Verifiable proof is preferentially cited over unsupported marketing claims.",
  },
};

export function fixForFlag(flag: AnswerFitnessFlag): FixTypeDef {
  return FIX_TYPES[flag];
}
