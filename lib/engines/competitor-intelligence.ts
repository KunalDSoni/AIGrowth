import type { AIVisibilityObservation } from "@/lib/domain/types";

/**
 * Competitor Intelligence Engine (EPIC COMP-001 / COMP-002).
 *
 * Keeps competitor categories separate (business, organic, local, AI-answer,
 * citation) so scoring never mixes an organic-search rival with an AI-answer
 * rival. Turns AI observations into mention/citation gaps, but only when the
 * sample size is large enough to support the conclusion.
 */

export type CompetitorType = "business" | "organic" | "local" | "ai-answer" | "citation";

export interface CompetitorRecord {
  name: string;
  type: CompetitorType;
  source: string;
  confidence: number;
  relevant: boolean;
}

export interface CompetitorGap {
  id: string;
  competitor: string;
  gapType: "mention" | "citation";
  detail: string;
  competitorRate: number;
  userRate: number;
  sampleSize: number;
  confidence: "High" | "Medium" | "Low";
}

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

/** Minimum observations before a competitor gap is trustworthy enough to act on. */
export const MIN_SAMPLE_SIZE = 3;

export function normalizeCompetitor(input: Partial<CompetitorRecord> & Pick<CompetitorRecord, "name">): CompetitorRecord {
  const valid: CompetitorType[] = ["business", "organic", "local", "ai-answer", "citation"];
  return {
    name: input.name.trim(),
    type: valid.includes(input.type as CompetitorType) ? (input.type as CompetitorType) : "business",
    source: input.source?.trim() || "user-supplied",
    confidence: clamp(input.confidence ?? 60),
    relevant: input.relevant ?? true,
  };
}

/** Apply a user correction to a competitor's type/relevance without losing provenance. */
export function correctCompetitor(record: CompetitorRecord, change: { type?: CompetitorType; relevant?: boolean }): CompetitorRecord {
  return {
    ...record,
    type: change.type ?? record.type,
    relevant: change.relevant ?? record.relevant,
    source: `${record.source} (user-corrected)`,
    confidence: 100,
  };
}

function rateOf(observations: AIVisibilityObservation[], predicate: (o: AIVisibilityObservation) => boolean): number {
  if (observations.length === 0) return 0;
  const hits = observations.filter(predicate).length;
  return Math.round((hits / observations.length) * 100);
}

function confidenceFor(sampleSize: number): CompetitorGap["confidence"] {
  if (sampleSize >= 6) return "Medium";
  if (sampleSize >= MIN_SAMPLE_SIZE) return "Low";
  return "Low";
}

/**
 * Detect prompt and citation gaps where a competitor appears but the user does
 * not. Only competitors that clear MIN_SAMPLE_SIZE and out-appear the user are
 * emitted, so weak evidence never produces a recommendation.
 */
export function detectCompetitorGaps(input: {
  observations: AIVisibilityObservation[];
  competitors: string[];
  firstPartyDomain: string;
}): CompetitorGap[] {
  const { observations, competitors, firstPartyDomain } = input;
  const gaps: CompetitorGap[] = [];
  if (observations.length < MIN_SAMPLE_SIZE) return gaps;

  const userMentionRate = rateOf(observations, (o) => o.brandMentions.length > 0);
  const userCitationRate = rateOf(observations, (o) =>
    o.citations.some((c) => c.domain.toLowerCase().includes(firstPartyDomain.toLowerCase())),
  );

  for (const competitor of competitors) {
    const name = competitor.toLowerCase();

    const competitorMentionRate = rateOf(observations, (o) =>
      o.competitorMentions.some((m) => m.toLowerCase().includes(name)),
    );
    if (competitorMentionRate > userMentionRate && competitorMentionRate >= 40) {
      gaps.push({
        id: `mention-gap-${competitor}`,
        competitor,
        gapType: "mention",
        detail: `${competitor} is mentioned in ${competitorMentionRate}% of AI answers vs your ${userMentionRate}%.`,
        competitorRate: competitorMentionRate,
        userRate: userMentionRate,
        sampleSize: observations.length,
        confidence: confidenceFor(observations.length),
      });
    }

    const competitorCitationRate = rateOf(observations, (o) =>
      o.citations.some((c) => c.domain.toLowerCase().includes(name)),
    );
    if (competitorCitationRate > userCitationRate && competitorCitationRate >= 40) {
      gaps.push({
        id: `citation-gap-${competitor}`,
        competitor,
        gapType: "citation",
        detail: `${competitor} is cited in ${competitorCitationRate}% of AI answers while your site is cited in ${userCitationRate}%.`,
        competitorRate: competitorCitationRate,
        userRate: userCitationRate,
        sampleSize: observations.length,
        confidence: confidenceFor(observations.length),
      });
    }
  }

  return gaps;
}
