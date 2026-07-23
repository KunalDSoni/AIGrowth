/**
 * Measured GEO (MDM-003).
 *
 * Runs prompts against a real AnswerEngineProvider and aggregates *measured*
 * citation presence, then optionally verifies each cited URL actually ranks via
 * a SerpProvider. Signals stay directional unless every observation is `measured`.
 */

import type { AnswerEngineProvider, AnswerObservation } from "@/lib/providers/answer-engine";
import type { SerpProvider } from "@/lib/providers/serp";
import { verifyCitation } from "@/lib/providers/serp";

export interface GeoMeasurement {
  brand?: string;
  observations: AnswerObservation[];
  sampleSize: number;
  brandMentionRate: number;
  /** Share of observations that carry at least one citation. */
  citationPresenceRate: number;
  /** "measured" only when every observation was measured; otherwise "simulated". */
  measurement: "measured" | "simulated";
  errors: string[];
}

export async function measureGeo(
  provider: AnswerEngineProvider,
  prompts: string[],
  opts: { brand?: string; engine?: string; market?: string } = {},
): Promise<GeoMeasurement> {
  const observations: AnswerObservation[] = [];
  const errors: string[] = [];
  for (const prompt of prompts) {
    try {
      observations.push(await provider.ask(prompt, { brand: opts.brand, engine: opts.engine, market: opts.market }));
    } catch (err) {
      errors.push(`${prompt}: ${(err as Error).message}`);
    }
  }
  const sampleSize = observations.length;
  const brandHits = observations.filter((o) => o.brandMentioned).length;
  const cited = observations.filter((o) => o.citations.length > 0).length;
  const allMeasured = sampleSize > 0 && observations.every((o) => o.measurement === "measured");
  return {
    brand: opts.brand,
    observations,
    sampleSize,
    brandMentionRate: sampleSize ? brandHits / sampleSize : 0,
    citationPresenceRate: sampleSize ? cited / sampleSize : 0,
    measurement: allMeasured ? "measured" : "simulated",
    errors,
  };
}

export interface CitationVerification {
  url: string;
  present: boolean;
  rank?: number;
}

/** Cross-check each answer citation against real SERP results. */
export async function verifyAnswerCitations(
  serp: SerpProvider,
  observation: AnswerObservation,
): Promise<CitationVerification[]> {
  const result = await serp.search(observation.prompt);
  return observation.citations.map((c) => ({ url: c.url, ...verifyCitation(result, c.url) }));
}
