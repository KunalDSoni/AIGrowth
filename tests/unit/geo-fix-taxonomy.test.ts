import { describe, expect, it } from "vitest";
import { FIX_TYPES, FIX_TAXONOMY_VERSION, fixForFlag } from "@/lib/engines/geo-fix-taxonomy";
import type { AnswerFitnessFlag } from "@/lib/engines/geo-brand-gap-diff";

const FLAGS: AnswerFitnessFlag[] = [
  "hasDirectAnswer",
  "hasFaqStructure",
  "hasComparisonContent",
  "hasStructuredPricing",
  "hasFreshnessSignal",
  "hasStructuredData",
  "hasProofSignal",
];

describe("geo fix taxonomy", () => {
  it("has exactly one entry per answer-fitness flag, keyed by what it addresses", () => {
    expect(Object.keys(FIX_TYPES).sort()).toEqual([...FLAGS].sort());
    for (const flag of FLAGS) {
      expect(FIX_TYPES[flag].addresses).toBe(flag);
    }
  });

  it("has unique fix ids", () => {
    const ids = FLAGS.map((f) => FIX_TYPES[f].id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps baseImpact, effort and assetType within their documented domains", () => {
    for (const flag of FLAGS) {
      const def = FIX_TYPES[flag];
      expect(def.baseImpact).toBeGreaterThanOrEqual(1);
      expect(def.baseImpact).toBeLessThanOrEqual(5);
      expect(["low", "medium", "high"]).toContain(def.effort);
      expect(["page", "section", "markup"]).toContain(def.assetType);
    }
  });

  it("returns the addressing fix via fixForFlag", () => {
    expect(fixForFlag("hasFaqStructure").id).toBe("faq-block");
    for (const flag of FLAGS) {
      expect(fixForFlag(flag).addresses).toBe(flag);
    }
  });

  it("has non-empty description and rationale for every entry", () => {
    for (const flag of FLAGS) {
      expect(FIX_TYPES[flag].description.length).toBeGreaterThan(0);
      expect(FIX_TYPES[flag].rationale.length).toBeGreaterThan(0);
    }
  });

  it("exposes a version", () => {
    expect(FIX_TAXONOMY_VERSION).toBeGreaterThanOrEqual(1);
  });
});
