// lib/windtunnel/engine.ts
import type { EvidenceItem, Stimulus, WindTunnelReport } from "./types";
import { SYNTHETIC_DISCLAIMER } from "./types";
import type { PersonaDistiller } from "./distiller";
import type { PersonaResponder } from "./responder";
import { runWindTunnel } from "./runner";
import { buildObjectionMap, rankVariants, segmentDeltas } from "./aggregate";

export async function runWindTunnelReport(args: {
  evidence: EvidenceItem[];
  stimulus: Stimulus;
  distiller: PersonaDistiller;
  responder: PersonaResponder;
  samples?: number;
}): Promise<WindTunnelReport> {
  const personas = args.distiller.distill(args.evidence);

  if (personas.length === 0) {
    return {
      label: "SYNTHETIC",
      disclaimer: SYNTHETIC_DISCLAIMER,
      ranking: [],
      objections: { byPersona: {}, overall: [] },
      segmentDeltas: [],
      personasUsed: 0,
      evidenceCount: args.evidence.length,
      confidence: "insufficient",
    };
  }

  const reactions = await runWindTunnel({
    personas,
    stimulus: args.stimulus,
    responder: args.responder,
    samples: args.samples,
  });

  return {
    label: "SYNTHETIC",
    disclaimer: SYNTHETIC_DISCLAIMER,
    ranking: rankVariants(reactions, args.stimulus),
    objections: buildObjectionMap(reactions),
    segmentDeltas: segmentDeltas(reactions, args.stimulus),
    personasUsed: personas.length,
    evidenceCount: args.evidence.length,
    confidence: "directional",
  };
}
