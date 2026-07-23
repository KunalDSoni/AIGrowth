/**
 * Single documented source of truth for readiness-scoring constants. Every
 * number here carries a written rationale so the product's scores are
 * defensible and tunable in one place.
 */

import type { Severity } from "@/lib/domain/types";
import type { ReadinessBand } from "@/lib/engines/readiness";

export interface SeverityModel {
  /** Points subtracted from a 100-point readiness score, per issue of this severity. */
  scorePenalty: number;
  /** Ordinal importance for ranking which issues are "top" (higher = more important). */
  rank: number;
  /** Why these values — the defensible reason. */
  rationale: string;
}

export const SEVERITY: Record<Severity, SeverityModel> = {
  critical: {
    scorePenalty: 15,
    rank: 4,
    rationale: "Blocks indexing or discovery; a single one materially suppresses visibility.",
  },
  high: {
    scorePenalty: 6,
    rank: 3,
    rationale: "Meaningfully weakens a page's ranking or conversion; several compound.",
  },
  "quick-win": {
    scorePenalty: 3,
    rank: 2,
    rationale: "Low-effort improvement with modest isolated impact.",
  },
  monitor: {
    scorePenalty: 1,
    rank: 1,
    rationale: "Minor; watch but rarely worth dedicated work.",
  },
  ignore: {
    scorePenalty: 0,
    rank: 0,
    rationale: "No action warranted.",
  },
};

export interface ReadinessBandDef {
  min: number;
  band: ReadinessBand;
  rationale: string;
}

/** Ordered high→low; the first whose `min` is met wins. */
export const READINESS_BANDS: ReadinessBandDef[] = [
  { min: 85, band: "excellent", rationale: "At most a few quick-wins remain; the site is discovery-ready." },
  { min: 70, band: "good", rationale: "Fundamentally sound with a handful of high-value fixes outstanding." },
  { min: 50, band: "fair", rationale: "Real gaps present; a focused pass yields visible gains." },
  { min: 0, band: "poor", rationale: "Critical blockers dominate; foundational work needed first." },
];
