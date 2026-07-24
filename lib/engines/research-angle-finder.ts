/**
 * PRE-3 — Angle Finder (Proprietary Research Engine, Frontier 3).
 *
 * Finds the citable questions: niche gaps where "a number would get cited, but
 * no source answers it". It reads the existing GEO citation ledger (GIL-01) —
 * the same per-prompt cited/mentioned/absent record the Influence Loop already
 * builds — and ranks study angles by citation potential.
 *
 * The signal is the intersection of two things:
 *   1. Data intent — the prompt asks for a quantitative fact (a percentage, an
 *      average, a benchmark). Those are the answers LLMs and journalists cite by
 *      *number*, which is exactly what an original study can own.
 *   2. Whitespace — no source (least of all a strong incumbent) already owns the
 *      citation. A prompt the brand is already cited on is not an angle; the job
 *      is done there.
 *
 * This engine only *finds* angles. It never fabricates the finding — that is
 * gated downstream by the Methodology Guard (PRE-1) and Analysis Engine (PRE-2).
 */

import type { CitationLedger, PromptCitationStatus } from "@/lib/analyze/types";

export interface StudyAngle {
  promptId: string;
  /** The originating GEO prompt. */
  prompt: string;
  /** 0–100 directional score: how likely an original number here gets cited. */
  citationPotential: number;
  /** The current citation state of this prompt in the ledger. */
  status: PromptCitationStatus;
  /** How many competitor domains currently answer this prompt (contest level). */
  contested: number;
  /** Plain-English why-this-angle. */
  rationale: string;
}

/**
 * Documented signals + weights. `DATA_INTENT_PATTERNS` are the surface cues that
 * a prompt wants a number; the weights are directional priors for ranking, never
 * measured citation lift.
 */
export const ANGLE_FINDER = {
  /** Cues that the prompt is asking for a quantitative fact. */
  DATA_INTENT_PATTERNS: [
    /\bhow (?:much|many|often)\b/i,
    /\b(?:percent|percentage|%)\b/i,
    /\b(?:average|median|mean)\b/i,
    /\b(?:rate|ratio|share|proportion)\b/i,
    /\b(?:benchmark|statistic|statistics|data)\b/i,
    /\b(?:cost|price|salary|budget|spend)\b/i,
    /\bnumber of\b/i,
    /\b(?:growth|trend|increase|decline)\b/i,
  ],
  /** Data-intent cues needed to saturate the intent score. */
  INTENT_SATURATION: 3,
  /** Weight on whitespace (is the citation uncontested?). */
  WHITESPACE_WEIGHT: 0.6,
  /** Weight on how few competitors currently answer. */
  CONTEST_WEIGHT: 0.4,
} as const;

export const ANGLE_FINDER_VERSION = 1;

const round = (v: number) => Math.round(v);

/** 0..1 — how strongly the prompt asks for a citable number. */
function dataIntentScore(prompt: string): number {
  const hits = ANGLE_FINDER.DATA_INTENT_PATTERNS.filter((re) => re.test(prompt)).length;
  return Math.min(hits, ANGLE_FINDER.INTENT_SATURATION) / ANGLE_FINDER.INTENT_SATURATION;
}

/** 0..1 — how open the citation is. Absent/unanswered are pure whitespace. */
function whitespaceScore(status: PromptCitationStatus): number {
  switch (status) {
    case "absent":
    case "unanswered":
      return 1;
    case "mentioned-not-cited":
      return 0.6;
    default:
      return 0; // "cited" — already owned, not an angle
  }
}

/**
 * Rank study angles from a citation ledger. Emits only prompts that (a) ask for a
 * number and (b) the brand does not already own the citation for. Sorted by
 * descending citation potential, tie-broken by prompt for determinism.
 */
export function findStudyAngles(
  ledger: CitationLedger,
  opts?: { limit?: number },
): StudyAngle[] {
  const angles: StudyAngle[] = [];

  for (const r of ledger.records) {
    const intent = dataIntentScore(r.prompt);
    const white = whitespaceScore(r.status);
    // No quantitative angle, or already-owned citation → not a study angle.
    if (intent === 0 || white === 0) continue;

    const contested = r.competitorDomains.length;
    const contestFactor = 1 / (1 + contested);
    const potential =
      100 *
      intent *
      (ANGLE_FINDER.WHITESPACE_WEIGHT * white + ANGLE_FINDER.CONTEST_WEIGHT * contestFactor);

    angles.push({
      promptId: r.promptId,
      prompt: r.prompt,
      citationPotential: round(potential),
      status: r.status,
      contested,
      rationale: buildRationale(r.status, contested),
    });
  }

  angles.sort(
    (a, b) => b.citationPotential - a.citationPotential || a.prompt.localeCompare(b.prompt),
  );

  return typeof opts?.limit === "number" ? angles.slice(0, opts.limit) : angles;
}

function buildRationale(status: PromptCitationStatus, contested: number): string {
  const contest =
    contested === 0
      ? "no competitor source answers it"
      : `only ${contested} competitor source${contested === 1 ? "" : "s"} answer${contested === 1 ? "s" : ""} it`;
  const own =
    status === "absent" || status === "unanswered"
      ? "the brand is absent here"
      : "the brand is mentioned but not cited";
  return `Quantitative question where ${contest}, and ${own} — an original statistic could own the citation.`;
}
