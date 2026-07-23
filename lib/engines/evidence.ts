import type { EvidenceReference } from "@/lib/domain/types";

/**
 * Evidence explainability helpers (EPIC EVID-002).
 *
 * Pure classification used by the evidence drawer so users can tell at a glance
 * which evidence is strong, weak, stale or simulated, which engine produced it,
 * and how fresh it is. No React here — the UI is a thin consumer.
 */

export type EvidenceStrength = "strong" | "moderate" | "weak";
export type EvidenceProvenance = "observed" | "estimated" | "simulated" | "inferred" | "user-supplied" | "calculated";
export type Freshness = "fresh" | "aging" | "stale" | "unknown";

export interface EvidenceView {
  id: string;
  summary: string;
  sourceEngine: string;
  strength: EvidenceStrength;
  provenance: EvidenceProvenance;
  freshness: Freshness;
  observedAt?: string;
  ageDays: number | null;
}

const ENGINE_BY_KIND: Record<EvidenceReference["kind"], string> = {
  CRAWL_OBSERVATION: "Crawl Engine",
  SEARCH_CONSOLE_METRIC: "Search Intelligence",
  ANALYTICS_METRIC: "Analytics",
  KEYWORD_PROVIDER_ESTIMATE: "Search Intelligence",
  SERP_OBSERVATION: "Search Intelligence",
  AI_ANSWER_OBSERVATION: "AI Visibility Engine",
  CITATION_OBSERVATION: "Citation Intelligence",
  COMPETITOR_OBSERVATION: "Competitor Intelligence",
  USER_SUPPLIED: "Business Understanding",
  AI_INFERENCE: "AI Inference",
  CALCULATED: "Recommendation Engine",
  SIMULATED: "Simulated Provider",
};

export function classifyStrength(reference: EvidenceReference): EvidenceStrength {
  if (reference.isSimulated && reference.reliability !== "HIGH") return "weak";
  if (reference.reliability === "HIGH") return "strong";
  if (reference.reliability === "MEDIUM") return reference.isEstimated ? "moderate" : "strong";
  return "weak";
}

export function classifyProvenance(reference: EvidenceReference): EvidenceProvenance {
  if (reference.isSimulated) return "simulated";
  if (reference.kind === "AI_INFERENCE") return "inferred";
  if (reference.kind === "USER_SUPPLIED") return "user-supplied";
  if (reference.kind === "CALCULATED") return "calculated";
  if (reference.isEstimated) return "estimated";
  return "observed";
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function classifyFreshness(reference: EvidenceReference, now: Date = new Date()): { freshness: Freshness; ageDays: number | null } {
  if (reference.validUntil) {
    const expired = new Date(reference.validUntil).getTime() < now.getTime();
    if (expired) return { freshness: "stale", ageDays: ageInDays(reference, now) };
  }
  const ageDays = ageInDays(reference, now);
  if (ageDays === null) return { freshness: "unknown", ageDays: null };
  if (ageDays <= 30) return { freshness: "fresh", ageDays };
  if (ageDays <= 120) return { freshness: "aging", ageDays };
  return { freshness: "stale", ageDays };
}

function ageInDays(reference: EvidenceReference, now: Date): number | null {
  const stamp = reference.observedAt ?? reference.retrievedAt;
  if (!stamp) return null;
  const diff = now.getTime() - new Date(stamp).getTime();
  return Math.max(0, Math.round(diff / DAY_MS));
}

export function toEvidenceView(reference: EvidenceReference, now: Date = new Date()): EvidenceView {
  const { freshness, ageDays } = classifyFreshness(reference, now);
  return {
    id: reference.id,
    summary: reference.summary,
    sourceEngine: ENGINE_BY_KIND[reference.kind] ?? "Unknown",
    strength: classifyStrength(reference),
    provenance: classifyProvenance(reference),
    freshness,
    observedAt: reference.observedAt ?? reference.retrievedAt,
    ageDays,
  };
}

export function summarizeEvidence(references: EvidenceReference[], now: Date = new Date()): {
  total: number;
  strong: number;
  simulated: number;
  stale: number;
  views: EvidenceView[];
} {
  const views = references.map((reference) => toEvidenceView(reference, now));
  return {
    total: views.length,
    strong: views.filter((v) => v.strength === "strong").length,
    simulated: views.filter((v) => v.provenance === "simulated").length,
    stale: views.filter((v) => v.freshness === "stale").length,
    views,
  };
}
