/**
 * OPS-3 — Measure fix lift (compose).
 *
 * A re-probe generates fresh prompt IDs, so the post observations are re-keyed
 * back to the intervention's affected prompt IDs (by order — runGeoProbes and the
 * caller preserve prompt order) before building the post-ledger and attributing
 * lift (GIL-11). Pure; the route supplies the re-probe GeoResult and the env-gated
 * provider call.
 */

import type { GeoResult } from "@/lib/analyze/types";
import { buildCitationLedger } from "@/lib/engines/geo-citation-ledger";
import { attributeLift, type CitationLift } from "@/lib/engines/geo-lift";
import type { InterventionRecord } from "@/lib/engines/geo-intervention";

export function measureFixLift(input: {
  intervention: InterventionRecord;
  orderedPromptIds: string[];
  geoResult: GeoResult;
  controlled?: boolean;
}): CitationLift {
  const rekeyed: GeoResult = {
    ...input.geoResult,
    observations: input.geoResult.observations.map((o, i) => ({
      ...o,
      id: input.orderedPromptIds[i] ?? o.id,
    })),
  };
  const postLedger = buildCitationLedger(rekeyed);
  return attributeLift({
    intervention: input.intervention,
    postLedger,
    controlled: input.controlled,
  });
}
