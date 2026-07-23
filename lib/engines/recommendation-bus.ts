import type { RecommendationScoreComponents } from "@/lib/domain/types";
import { calculateRecommendationPriority } from "@/lib/engines/priority";

/**
 * Unified Recommendation Candidate Bus (EPIC REC-001 / REC-002).
 *
 * Every engine emits comparable candidates through this one contract so the
 * recommendation engine can rank technical, search, AI-visibility, citation,
 * content and competitor opportunities on the same scale. A candidate with no
 * evidence is invalid — recommendations must always be explainable.
 */

export type SourceEngine =
  | "technical"
  | "search"
  | "content"
  | "ai-visibility"
  | "citation"
  | "competitor"
  | "outcome";

export type RecommendationBucket =
  | "critical"
  | "high-impact"
  | "quick-win"
  | "strategic-bet"
  | "monitor"
  | "ignore";

export interface RecommendationCandidate {
  id: string;
  source: SourceEngine;
  title: string;
  action: string;
  evidenceIds: string[];
  scoreComponents: RecommendationScoreComponents;
}

export interface RankedCandidate extends RecommendationCandidate {
  rank: number;
  priorityScore: number;
  impactScore: number;
  feasibilityScore: number;
  bucket: RecommendationBucket;
  explanation: string;
}

export class InvalidCandidateError extends Error {}

const REQUIRED_COMPONENTS: (keyof RecommendationScoreComponents)[] = [
  "businessRelevance",
  "conversionPotential",
  "discoveryOpportunity",
  "severity",
  "strategicAlignment",
  "urgency",
  "effort",
  "evidenceConfidence",
  "risk",
  "dependencyReadiness",
];

/** Validate a candidate. Throws InvalidCandidateError when un-rankable. */
export function validateCandidate(candidate: RecommendationCandidate): void {
  if (!candidate.id || !candidate.title.trim()) {
    throw new InvalidCandidateError("Candidate requires an id and title.");
  }
  if (candidate.evidenceIds.length === 0) {
    throw new InvalidCandidateError(`Candidate "${candidate.id}" has no evidence; recommendations must be explainable.`);
  }
  for (const key of REQUIRED_COMPONENTS) {
    const value = candidate.scoreComponents[key];
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new InvalidCandidateError(`Candidate "${candidate.id}" is missing score component "${key}".`);
    }
  }
}

function bucketFor(c: RankedCandidate): RecommendationBucket {
  const { severity, effort, businessRelevance, strategicAlignment, evidenceConfidence } = c.scoreComponents;
  if (severity >= 80 && c.impactScore >= 60) return "critical";
  if (c.priorityScore < 20 || evidenceConfidence < 30) return "ignore";
  if (effort <= 25 && c.impactScore >= 45) return "quick-win";
  if (c.impactScore >= 65) return "high-impact";
  if (strategicAlignment >= 75 && businessRelevance >= 75) return "strategic-bet";
  return "monitor";
}

function explain(c: RankedCandidate): string {
  return `${c.source} · impact ${c.impactScore}/100 × feasibility ${c.feasibilityScore}/100 = priority ${c.priorityScore}/100. Placed in "${c.bucket}" from severity, effort, evidence confidence and strategic alignment. Decision-support only — not a forecast.`;
}

/**
 * Rank a mixed set of candidates and assign each a bucket. Invalid candidates
 * are rejected up front so a weak-evidence item can never outrank a real one.
 */
export function rankCandidates(candidates: RecommendationCandidate[]): RankedCandidate[] {
  for (const candidate of candidates) validateCandidate(candidate);

  const scored: RankedCandidate[] = candidates.map((candidate) => {
    const score = calculateRecommendationPriority(candidate.scoreComponents);
    const partial: RankedCandidate = {
      ...candidate,
      rank: 0,
      priorityScore: score.priorityScore,
      impactScore: score.impactScore,
      feasibilityScore: score.feasibilityScore,
      bucket: "monitor",
      explanation: "",
    };
    partial.bucket = bucketFor(partial);
    partial.explanation = explain(partial);
    return partial;
  });

  scored.sort((a, b) => b.priorityScore - a.priorityScore);
  scored.forEach((candidate, index) => {
    candidate.rank = index + 1;
  });
  return scored;
}

export function groupByBucket(ranked: RankedCandidate[]): Record<RecommendationBucket, RankedCandidate[]> {
  const buckets: RecommendationBucket[] = ["critical", "high-impact", "quick-win", "strategic-bet", "monitor", "ignore"];
  const grouped = Object.fromEntries(buckets.map((b) => [b, [] as RankedCandidate[]])) as Record<RecommendationBucket, RankedCandidate[]>;
  for (const candidate of ranked) grouped[candidate.bucket].push(candidate);
  return grouped;
}
