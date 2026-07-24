// lib/windtunnel/types.ts

export type SegmentId = string;

export interface EvidenceItem {
  id: string;
  source: "review" | "call_note" | "ticket" | "gsc_query" | "won_loss";
  segment?: SegmentId;
  text: string; // verbatim customer voice
  sentiment: "positive" | "negative" | "neutral";
}

export interface Persona {
  id: string;
  segment: SegmentId;
  jobsToBeDone: string[];
  objections: string[]; // extracted objection themes
  vocabulary: string[]; // words the segment actually uses
  quoteIds: string[]; // provenance: EvidenceItem ids backing this persona
}

export interface Variant {
  id: string;
  text: string;
}

export interface Stimulus {
  id: string;
  kind: "headline" | "landing_page";
  variants: Variant[]; // 2+ for comparative choice
}

export interface ForcedChoice {
  winnerVariantId: string;
  reason: string;
  objectionsRaised: string[];
}

export interface PersonaReaction {
  personaId: string;
  segment: SegmentId;
  choices: ForcedChoice[]; // one per sample
}

export interface VariantScore {
  variantId: string;
  wins: number;
  samples: number;
  winShare: number; // 0..1
}

export interface ObjectionMap {
  byPersona: Record<string, string[]>;
  overall: { objection: string; count: number }[];
}

export interface SegmentDelta {
  variantId: string;
  bySegment: Record<SegmentId, number>; // winShare within each segment
}

export interface WindTunnelReport {
  label: "SYNTHETIC";
  disclaimer: string;
  ranking: VariantScore[]; // sorted desc by winShare
  objections: ObjectionMap;
  segmentDeltas: SegmentDelta[];
  personasUsed: number;
  evidenceCount: number;
  confidence: "directional" | "insufficient";
}

export interface CalibrationRecord {
  stimulusId: string;
  predictedWinnerVariantId: string;
  actualWinnerVariantId: string;
}

export const SYNTHETIC_DISCLAIMER =
  "SYNTHETIC — hypothesis, not measurement. Confirm with a real experiment before acting.";
