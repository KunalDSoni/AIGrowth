// lib/research/types.ts

export interface CitationGap {
  question: string; // e.g. "What % of freelancers raise rates yearly?"
  topic: string;
  askVolume: number; // how often it is asked (proxy demand)
  existingSources: number; // credible sources already answering (0 = whitespace)
}

export interface StudyAngle {
  id: string;
  question: string;
  topic: string;
  citationPotential: number; // higher = more citable
  rationale: string;
}

export type License = "open" | "public_domain" | "cc_by" | "proprietary_first_party" | "unknown";

export interface DatasetProvenance {
  source: string;
  license: License;
  retrievedAt: string; // ISO
}

export interface Observation {
  matched: boolean; // did this record meet the study criterion?
}

export interface Dataset {
  id: string;
  provenance: DatasetProvenance;
  observations: Observation[];
  population?: string;
  sampleFrame?: string;
}

export interface Methodology {
  question: string;
  metric: string; // what is measured
  method: "proportion"; // v1 supports proportions only
  preRegisteredAt: string; // ISO
  minSampleSize: number;
}

export type SupportVerdict = "supported" | "directional" | "insufficient" | "unlicensed";

export interface MethodologyCheck {
  verdict: SupportVerdict;
  reason: string;
}

export interface StudyFinding {
  question: string;
  headlineStat: string; // "62% of ..."
  value: number; // percent
  interval: { low: number; high: number }; // percent
  n: number;
  source: string;
  method: string;
  confidence: "high" | "medium" | "low" | "insufficient";
}

export type PublishState = "draft" | "approved";

export interface Study {
  angleId: string;
  methodology: Methodology;
  check: MethodologyCheck;
  finding: StudyFinding | null; // null when integrity refuses
  datasetSchema: Record<string, unknown>; // schema.org/Dataset JSON-LD
  publishState: PublishState; // engine always emits "draft"
  integrityNote: string;
}

export const INTEGRITY_REFUSAL =
  "Insufficient / unlicensed data — we won't publish a claim we can't defend.";
