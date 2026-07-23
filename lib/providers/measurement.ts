/**
 * Shared provenance vocabulary for the ingestion + data-mesh adapters (OSI + MDM).
 *
 * Every record any adapter produces declares:
 *  - `source`: which tool/vendor produced it (e.g. "crawlee", "perplexity", "mock").
 *  - `measurement`: how strongly the value is grounded in reality.
 *
 * This is the auditable-evidence non-negotiable made explicit. It never hides
 * weak evidence: a modelled number is `estimate`, an LLM probe is `simulated`,
 * and only a real observed signal is `measured`.
 */

export type MeasurementLabel = "measured" | "simulated" | "estimate";

export interface Provenance {
  source: string;
  measurement: MeasurementLabel;
  observedAt: string;
}

export function provenance(source: string, measurement: MeasurementLabel, observedAt = new Date().toISOString()): Provenance {
  return { source, measurement, observedAt };
}

/** Maps a measurement label onto the existing EvidenceReference honesty flags. */
export function evidenceFlags(measurement: MeasurementLabel): { isEstimated: boolean; isSimulated: boolean } {
  return {
    isEstimated: measurement === "estimate",
    isSimulated: measurement === "simulated",
  };
}

/** Reads a boolean-ish env flag. */
export function envFlag(value: string | undefined): boolean {
  return value === "true" || value === "1" || value === "yes";
}
