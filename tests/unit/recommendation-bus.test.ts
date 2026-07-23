import { describe, expect, it } from "vitest";
import {
  groupByBucket,
  InvalidCandidateError,
  rankCandidates,
  validateCandidate,
  type RecommendationCandidate,
} from "@/lib/engines/recommendation-bus";
import type { RecommendationScoreComponents } from "@/lib/domain/types";

function components(overrides: Partial<RecommendationScoreComponents> = {}): RecommendationScoreComponents {
  return {
    businessRelevance: 80,
    conversionPotential: 70,
    discoveryOpportunity: 60,
    severity: 50,
    strategicAlignment: 75,
    urgency: 60,
    effort: 30,
    evidenceConfidence: 70,
    risk: 20,
    dependencyReadiness: 80,
    ...overrides,
  };
}

function candidate(id: string, overrides: Partial<RecommendationCandidate> = {}): RecommendationCandidate {
  return {
    id,
    source: "technical",
    title: `Candidate ${id}`,
    action: "Do the thing",
    evidenceIds: ["ev-1"],
    scoreComponents: components(),
    ...overrides,
  };
}

describe("validateCandidate", () => {
  it("rejects a candidate with no evidence", () => {
    expect(() => validateCandidate(candidate("a", { evidenceIds: [] }))).toThrow(InvalidCandidateError);
  });

  it("rejects a candidate missing a score component", () => {
    const bad = candidate("b");
    // @ts-expect-error deliberately break the shape
    delete bad.scoreComponents.effort;
    expect(() => validateCandidate(bad)).toThrow(InvalidCandidateError);
  });

  it("accepts a well-formed candidate", () => {
    expect(() => validateCandidate(candidate("c"))).not.toThrow();
  });
});

describe("rankCandidates", () => {
  it("ranks by priority score descending and assigns ranks", () => {
    const ranked = rankCandidates([
      candidate("low", { scoreComponents: components({ businessRelevance: 20, conversionPotential: 20, effort: 90 }) }),
      candidate("high", { scoreComponents: components({ businessRelevance: 95, conversionPotential: 95, effort: 10 }) }),
    ]);
    expect(ranked[0].id).toBe("high");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].priorityScore).toBeGreaterThan(ranked[1].priorityScore);
  });

  it("labels a severe high-impact item as critical", () => {
    const ranked = rankCandidates([
      candidate("crit", { scoreComponents: components({ severity: 90, businessRelevance: 95, conversionPotential: 90, effort: 20 }) }),
    ]);
    expect(ranked[0].bucket).toBe("critical");
  });

  it("labels a low-effort decent-impact item as a quick win", () => {
    const ranked = rankCandidates([
      candidate("qw", { scoreComponents: components({ severity: 40, effort: 15, businessRelevance: 70, conversionPotential: 70 }) }),
    ]);
    expect(ranked[0].bucket).toBe("quick-win");
  });

  it("labels a weak-evidence low-priority item as ignore", () => {
    const ranked = rankCandidates([
      candidate("ig", { scoreComponents: components({ businessRelevance: 10, conversionPotential: 10, discoveryOpportunity: 10, severity: 10, effort: 95, evidenceConfidence: 10 }) }),
    ]);
    expect(ranked[0].bucket).toBe("ignore");
  });

  it("every ranked candidate carries an explanation", () => {
    const ranked = rankCandidates([candidate("x")]);
    expect(ranked[0].explanation).toMatch(/priority/i);
  });
});

describe("groupByBucket", () => {
  it("places candidates into their buckets and includes all keys", () => {
    const ranked = rankCandidates([candidate("a"), candidate("b")]);
    const grouped = groupByBucket(ranked);
    expect(Object.keys(grouped)).toEqual(["critical", "high-impact", "quick-win", "strategic-bet", "monitor", "ignore"]);
    const total = Object.values(grouped).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(2);
  });
});
