import type { AnswerFitnessFeatures, CitedSourceFeatureProfile } from "@/lib/engines/geo-cited-source-features";

/**
 * GIL-03 — Brand-page gap diff.
 *
 * Diff the brand's own answer-fitness features against the cited-source profiles
 * (GIL-02) to surface the concrete features competitors have that the brand
 * lacks — the direct input to the GIL-05 recommender. Pure over its two inputs;
 * the caller extracts the brand's features with the same `extractAnswerFitness`.
 *
 * A gap is only ever inferred from a source we actually read: unreachable
 * profiles are excluded from the denominator, never counted against the brand.
 */

export type AnswerFitnessFlag =
  | "hasDirectAnswer"
  | "hasFaqStructure"
  | "hasComparisonContent"
  | "hasStructuredPricing"
  | "hasFreshnessSignal"
  | "hasStructuredData"
  | "hasProofSignal";

const FLAGS: AnswerFitnessFlag[] = [
  "hasDirectAnswer",
  "hasFaqStructure",
  "hasComparisonContent",
  "hasStructuredPricing",
  "hasFreshnessSignal",
  "hasStructuredData",
  "hasProofSignal",
];

export interface FeatureGap {
  feature: AnswerFitnessFlag;
  brandHas: boolean;
  competitorsWithFeature: number;
  competitorsProfiled: number;
  competitorShare: number;
  affectedPrompts: string[];
  isGap: boolean;
}

export interface BrandGapDiff {
  brandFeatures: AnswerFitnessFeatures;
  gaps: FeatureGap[];
  topGaps: FeatureGap[];
  reliable: boolean;
}

export function buildBrandGapDiff(
  brandFeatures: AnswerFitnessFeatures,
  profiles: CitedSourceFeatureProfile[],
): BrandGapDiff {
  const extracted = profiles.filter(
    (p): p is CitedSourceFeatureProfile & { features: AnswerFitnessFeatures } =>
      p.crawlStatus === "extracted" && Boolean(p.features),
  );
  const competitorsProfiled = extracted.length;

  const gaps: FeatureGap[] = FLAGS.map((feature) => {
    const withFeature = extracted.filter((p) => p.features[feature]);
    const competitorsWithFeature = withFeature.length;
    const affectedPrompts = [...new Set(withFeature.flatMap((p) => p.citedForPrompts))];
    const competitorShare = competitorsProfiled
      ? Math.round((competitorsWithFeature / competitorsProfiled) * 100) / 100
      : 0;
    const brandHas = brandFeatures[feature];
    return {
      feature,
      brandHas,
      competitorsWithFeature,
      competitorsProfiled,
      competitorShare,
      affectedPrompts,
      isGap: !brandHas && competitorsWithFeature > 0,
    };
  });

  gaps.sort(
    (a, b) =>
      Number(b.isGap) - Number(a.isGap) ||
      b.competitorShare - a.competitorShare ||
      a.feature.localeCompare(b.feature),
  );

  return {
    brandFeatures,
    gaps,
    topGaps: gaps.filter((g) => g.isGap),
    reliable: competitorsProfiled > 0,
  };
}
