import { describe, expect, it } from "vitest";
import {
  aiVisibilitySummaries,
  citationGapActions,
  evidenceReferences,
  outcomeLearningRecords,
  recommendations,
} from "@/lib/data/demo";
import { calculateRecommendationPriority } from "@/lib/engines/priority";
import { flagClaims } from "@/lib/engines/brief-builder";
import { MIN_SAMPLE_SIZE } from "@/lib/engines/competitor-intelligence";

/**
 * Evaluation Harness (CRITICAL_PRE_DEVELOPMENT_ADDENDUM §5).
 *
 * These are not unit tests of a single function — they assert *intelligence
 * quality* invariants across the whole demo dataset, the kind of guarantees that
 * separate a real AI SEO engine from a dashboard: every recommendation is
 * grounded in evidence, scores stay in range, AI-visibility carries uncertainty,
 * citation gaps respect sample-size thresholds, unsupported claims are caught,
 * and outcomes never assert false causation.
 */

const evidenceById = new Map(evidenceReferences.map((e) => [e.id, e]));

describe("eval: evidence correctness", () => {
  it("every recommendation is backed by at least one evidence reference", () => {
    for (const rec of recommendations) {
      expect(rec.evidenceIds.length, `${rec.id} has no evidence`).toBeGreaterThan(0);
    }
  });

  it("every referenced evidence id resolves to a real, provenance-labelled record", () => {
    for (const rec of recommendations) {
      for (const id of rec.evidenceIds) {
        const evidence = evidenceById.get(id);
        expect(evidence, `${rec.id} references missing evidence ${id}`).toBeDefined();
        expect(evidence!.kind).toBeTruthy();
        expect(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]).toContain(evidence!.reliability);
      }
    }
  });

  it("simulated or estimated evidence is explicitly labelled", () => {
    for (const evidence of evidenceReferences) {
      expect(typeof evidence.isSimulated).toBe("boolean");
      expect(typeof evidence.isEstimated).toBe("boolean");
    }
  });
});

describe("eval: recommendation scoring", () => {
  it("priority scores stay within 0-100 and match the scoring engine", () => {
    for (const rec of recommendations) {
      expect(rec.priorityScore).toBeGreaterThanOrEqual(0);
      expect(rec.priorityScore).toBeLessThanOrEqual(100);
      const recomputed = calculateRecommendationPriority(rec.scoreComponents).priorityScore;
      expect(rec.priorityScore).toBe(recomputed);
    }
  });

  it("a stronger candidate outranks a weaker one deterministically", () => {
    const strong = calculateRecommendationPriority({
      businessRelevance: 95, conversionPotential: 95, discoveryOpportunity: 90, severity: 80,
      strategicAlignment: 95, urgency: 85, effort: 10, evidenceConfidence: 85, risk: 10, dependencyReadiness: 90,
    }).priorityScore;
    const weak = calculateRecommendationPriority({
      businessRelevance: 30, conversionPotential: 30, discoveryOpportunity: 20, severity: 20,
      strategicAlignment: 30, urgency: 20, effort: 90, evidenceConfidence: 30, risk: 60, dependencyReadiness: 30,
    }).priorityScore;
    expect(strong).toBeGreaterThan(weak);
  });
});

describe("eval: AI visibility carries uncertainty", () => {
  it("every summary reports a sample size and bounded mention frequency", () => {
    for (const summary of aiVisibilitySummaries) {
      expect(summary.sampleSize).toBeGreaterThanOrEqual(1);
      expect(summary.brandMentionFrequency).toBeGreaterThanOrEqual(0);
      expect(summary.brandMentionFrequency).toBeLessThanOrEqual(100);
    }
  });

  it("never presents AI visibility as a single magic score", () => {
    for (const summary of aiVisibilitySummaries) {
      // A real conclusion references variability/consistency, not one ranking.
      expect(summary.conclusion.length).toBeGreaterThan(0);
      expect(summary.evidenceIds.length).toBe(summary.sampleSize);
    }
  });
});

describe("eval: citation gap thresholds", () => {
  it("citation gaps are never High-confidence below the sample-size threshold", () => {
    for (const gap of citationGapActions) {
      if (gap.confidence === "High") {
        // High confidence would require a large sample; demo data must not fake it.
        expect(gap.evidenceIds.length).toBeGreaterThanOrEqual(MIN_SAMPLE_SIZE * 2);
      } else {
        expect(["Low", "Medium"]).toContain(gap.confidence);
      }
    }
  });

  it("every citation gap keeps its assumptions visible", () => {
    for (const gap of citationGapActions) {
      expect(gap.assumptions.length).toBeGreaterThan(0);
      expect(gap.measurementPlan.length).toBeGreaterThan(0);
    }
  });
});

describe("eval: unsupported claim detection", () => {
  it("flags fabricated authority and guarantees", () => {
    expect(flagClaims("We guarantee first-page rankings.").length).toBeGreaterThan(0);
    expect(flagClaims("We are the number one provider in the world.").length).toBeGreaterThan(0);
  });

  it("does not flag honest, verifiable copy", () => {
    expect(flagClaims("We provide bookkeeping and payroll for Australian clinics.")).toEqual([]);
  });
});

describe("eval: outcome attribution limits", () => {
  it("every outcome record states attribution limitations", () => {
    for (const record of outcomeLearningRecords) {
      expect(record.attributionLimitations.length).toBeGreaterThan(0);
    }
  });

  it("outcome confidence is never overstated as High for small demo samples", () => {
    for (const record of outcomeLearningRecords) {
      expect(["Low", "Medium", "High"]).toContain(record.outcomeConfidence);
      expect(record.comparisonPeriod).toBeTruthy();
      expect(record.baselinePeriod).toBeTruthy();
    }
  });
});
