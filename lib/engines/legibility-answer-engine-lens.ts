/**
 * MLE-4 — Answer-Engine lens (Machine Legibility Engine, Frontier 4).
 *
 * Views the legibility gaps through the question "how do answer engines describe,
 * mention, and cite this brand?" and routes each gap to the channels where a
 * correction actually lands: on-site schema (the canonical source LLMs read),
 * Wikidata/Wikipedia (what knowledge panels draw from), review sites, Reddit, or
 * a primary-source publication.
 *
 * It also consumes "fuel from Frontier 3": a published, human-approved study is a
 * real public source, so a supporting study can make an otherwise-uncorrectable
 * gap correctable via the primary-source channel. Nothing here submits anything —
 * it prepares the routing; the Correction Playbook (MLE-6) stays human-gated.
 */

import type { EntityGraph, BeliefSource } from "@/lib/engines/legibility-entity-graph";
import type { LegibilityGap, GapKind } from "@/lib/engines/legibility-gap-finder";

export type CorrectionChannel =
  | "on-site-schema"
  | "wikidata"
  | "wikipedia"
  | "review-sites"
  | "reddit"
  | "primary-source";

export interface AnswerEngineLensItem {
  attribute: string;
  gapKind: GapKind;
  machineBelief?: string;
  truth?: string;
  impact: number;
  /** Actionable once a source (registry or study) backs the correction. */
  correctable: boolean;
  /** Where to land the correction, de-duplicated and ordered. */
  channels: CorrectionChannel[];
  /** Present when a published Frontier-3 study substantiates the correction. */
  fueledByStudy?: string;
  rationale: string;
}

export interface AnswerEngineLensReport {
  subject: string;
  items: AnswerEngineLensItem[];
  correctableCount: number;
}

/** Which correction channels each belief source implies when it holds a wrong value. */
export const SOURCE_CHANNELS: Record<BeliefSource, CorrectionChannel[]> = {
  "knowledge-panel": ["wikidata", "wikipedia"],
  wikidata: ["wikidata"],
  "on-site-schema": ["on-site-schema"],
  "answer-engine": ["on-site-schema"],
  "review-site": ["review-sites"],
  reddit: ["reddit"],
};

const CHANNEL_ORDER: CorrectionChannel[] = [
  "on-site-schema",
  "primary-source",
  "wikidata",
  "wikipedia",
  "review-sites",
  "reddit",
];

export const ANSWER_ENGINE_LENS_VERSION = 1;

const norm = (s: string) => s.trim().toLowerCase();

function orderChannels(set: Set<CorrectionChannel>): CorrectionChannel[] {
  return CHANNEL_ORDER.filter((c) => set.has(c));
}

/**
 * Build the answer-engine lens over the gaps. `supportingFacts` maps an attribute
 * to the published study id that substantiates it (fuel from Frontier 3).
 */
export function buildAnswerEngineLens(input: {
  graph: EntityGraph;
  gaps: LegibilityGap[];
  supportingFacts?: { attribute: string; sourceStudyId: string }[];
}): AnswerEngineLensReport {
  const factByAttr = new Map<string, string>();
  for (const f of input.supportingFacts ?? []) factByAttr.set(norm(f.attribute), f.sourceStudyId);

  const items: AnswerEngineLensItem[] = input.gaps.map((gap) => {
    const belief = input.graph.beliefs.find((b) => norm(b.attribute) === norm(gap.attribute));
    const fueledByStudy = factByAttr.get(norm(gap.attribute));
    const correctable = gap.correctable || Boolean(fueledByStudy);

    const channels = new Set<CorrectionChannel>();
    if (correctable) {
      // The canonical machine-readable source is always in play.
      channels.add("on-site-schema");
      if (gap.kind === "mismatch" && belief) {
        // Fix the correction where the wrong belief currently lives.
        for (const v of belief.variants) {
          if (norm(v.value) === norm(gap.truth ?? "")) continue;
          for (const src of v.sources) for (const ch of SOURCE_CHANNELS[src]) channels.add(ch);
        }
      } else if (gap.kind === "missing") {
        // Publish the fact where machines look it up.
        channels.add("wikidata");
      }
      if (fueledByStudy) channels.add("primary-source");
    }

    return {
      attribute: gap.attribute,
      gapKind: gap.kind,
      machineBelief: gap.machineBelief,
      truth: gap.truth,
      impact: gap.impact,
      correctable,
      channels: orderChannels(channels),
      fueledByStudy,
      rationale: buildRationale(gap, correctable, fueledByStudy),
    };
  });

  return {
    subject: input.graph.subject,
    items,
    correctableCount: items.filter((i) => i.correctable).length,
  };
}

function buildRationale(gap: LegibilityGap, correctable: boolean, study?: string): string {
  if (!correctable) {
    return gap.kind === "unconfirmed"
      ? "Machines assert this but nothing verifies it — verify it in the registry before acting."
      : "No source backs the correction yet — substantiate the fact (a Frontier-3 study can supply one).";
  }
  if (study) {
    return `Correctable, substantiated by study ${study}: land the sourced fact on the canonical channels and cite the study.`;
  }
  return "Correctable from verified truth: land the sourced fact on the canonical channels.";
}
