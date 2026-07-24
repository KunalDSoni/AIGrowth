/**
 * PRE-6 — Research Engine orchestration + distribution hook (Frontier 3).
 *
 * Thin composition over the research pieces:
 *  - `buildResearchPlan` turns a live GEO citation ledger into ranked study
 *    angles (PRE-3). This runs on real scan data with no external dependency.
 *  - `studyToEntityFact` is the distribution hook into Frontier 4 (Machine
 *    Legibility): it converts a *published* study's headline into an entity-fact
 *    candidate the legibility engine can use to correct what machines believe —
 *    the "fuel from Frontier 3" the F4 spec calls for.
 *
 * Composing a full study additionally needs licensed datasets (PRE-4). Offline,
 * with no sourced data, the plan surfaces angles only and reports
 * `canCompose: false` — an honest empty state, never fabricated findings.
 */

import type { CitationLedger } from "@/lib/analyze/types";
import { findStudyAngles, type StudyAngle } from "@/lib/engines/research-angle-finder";
import type { Study } from "@/lib/engines/research-study-composer";
import type { ClaimStrength } from "@/lib/engines/research-methodology-guard";

export interface ResearchPlan {
  /** Ranked citable angles from the live ledger. */
  angles: StudyAngle[];
  /** Whether licensed data is available to compose a study end-to-end. */
  canCompose: boolean;
  /** Plain-English status for the surface. */
  note: string;
  generatedAt: string;
}

/**
 * An entity fact ready to hand to Frontier 4. It is a *sourced* claim — carrying
 * the study's provenance and strength — because F4 only makes true, sourced
 * corrections. This is the shape, not the submission; F4 gates the actual use.
 */
export interface EntityFactCandidate {
  subject: string;
  /** The citable claim, e.g. the headline stat. */
  claim: string;
  value: number;
  unit: string;
  strength: ClaimStrength;
  /** Methodology provenance carried from the study. */
  provenance: string;
  sourceStudyId: string;
}

export const RESEARCH_ENGINE_VERSION = 1;

export function buildResearchPlan(
  ledger: CitationLedger,
  opts?: { canCompose?: boolean; now?: string; limit?: number },
): ResearchPlan {
  const angles = findStudyAngles(ledger, opts?.limit ? { limit: opts.limit } : undefined);
  const canCompose = opts?.canCompose ?? false;
  const note = canCompose
    ? "Licensed data available — angles can be composed into studies end-to-end."
    : angles.length > 0
      ? "Angles found. Composing a study needs licensed datasets; connect a data source to proceed."
      : "No citable angles in the current ledger yet.";
  return {
    angles,
    canCompose,
    note,
    generatedAt: opts?.now ?? new Date().toISOString(),
  };
}

/**
 * Distribution hook into Frontier 4. Only a *published* study with a defensible
 * headline can fuel entity corrections — throws otherwise, so an unproven or
 * insufficient claim can never leak into the machine-belief pipeline.
 */
export function studyToEntityFact(study: Study): EntityFactCandidate {
  if (study.status !== "published") {
    throw new Error("Only a published study can fuel an entity fact.");
  }
  if (!study.headline) {
    throw new Error("A study with no defensible headline cannot fuel an entity fact.");
  }
  return {
    subject: study.brand,
    claim: study.headline.headline,
    value: study.headline.value,
    unit: study.headline.unit,
    strength: study.headline.strength,
    provenance: study.methodologyStatement,
    sourceStudyId: study.id,
  };
}
