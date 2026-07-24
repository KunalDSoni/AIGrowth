/**
 * MLE-3 — Gap Finder + integrity guard (Machine Legibility Engine, Frontier 4).
 *
 * The payload of the whole engine: one diff between what the machines currently
 * believe (MLE-2 entity graph) and the verified truth (MLE-1 registry), ranked
 * by commercial impact. Three gap kinds:
 *
 *  - mismatch    — machines assert a value that contradicts the truth.
 *  - missing     — the truth is verified but machines hold no belief.
 *  - unconfirmed — machines assert something the registry cannot verify.
 *
 * The integrity guard is non-negotiable: a gap is only `correctable` when a
 * *publicly-sourced* ground-truth fact backs it. A truth fact with no source, or
 * an unverifiable machine belief, is surfaced honestly but marked not-correctable
 * — matching the F4 rules "belief unverifiable → mark unconfirmed, do not force a
 * correction" and "ground-truth lacks a source → cannot be used in a public
 * correction (loops to Frontier 3)".
 */

import {
  isPubliclyUsable,
  type FactCategory,
  type GroundTruthRegistry,
} from "@/lib/engines/legibility-ground-truth";
import { type EntityGraph } from "@/lib/engines/legibility-entity-graph";

export type GapKind = "mismatch" | "missing" | "unconfirmed";

export interface LegibilityGap {
  attribute: string;
  kind: GapKind;
  /** The consensus value machines hold, when any. */
  machineBelief?: string;
  /** The verified value, when any. */
  truth?: string;
  /** Whether machines disagree among themselves on this attribute. */
  contested: boolean;
  /** True only when a publicly-sourced truth fact can back a correction. */
  correctable: boolean;
  /** 0–100 commercial-impact rank. */
  impact: number;
  category: FactCategory;
  rationale: string;
}

/** Commercial weight per fact category — what it costs to be wrong here. */
export const CATEGORY_IMPACT: Record<FactCategory, number> = {
  price: 30,
  offering: 28,
  category: 26,
  differentiator: 22,
  spec: 18,
  "service-area": 16,
  other: 10,
};

/** Severity multiplier per gap kind. An actively wrong machine is worst. */
export const KIND_SEVERITY: Record<GapKind, number> = {
  mismatch: 1,
  missing: 0.7,
  unconfirmed: 0.5,
};

const IMPACT_SCALE = 3;
const CONTESTED_BONUS = 1.15;

export const GAP_FINDER_VERSION = 1;

const norm = (s: string) => s.trim().toLowerCase();
const clamp100 = (v: number) => Math.max(0, Math.min(100, v));

function scoreImpact(
  category: FactCategory,
  kind: GapKind,
  contested: boolean,
  wrongReach: number,
): number {
  const base = CATEGORY_IMPACT[category] * KIND_SEVERITY[kind] * IMPACT_SCALE;
  // The more machine belief mass contradicts the truth, the more people meet the
  // wrong answer → higher impact.
  const reachFactor = kind === "mismatch" ? 0.6 + 0.4 * wrongReach : 1;
  const contestedFactor = contested ? CONTESTED_BONUS : 1;
  return Math.round(clamp100(base * reachFactor * contestedFactor));
}

/** Share of machine belief weight (0..1) whose value contradicts the truth. */
function wrongReachShare(variants: { value: string; weight: number }[], truth: string): number {
  const total = variants.reduce((s, v) => s + v.weight, 0);
  if (total <= 0) return 0;
  const wrong = variants
    .filter((v) => norm(v.value) !== norm(truth))
    .reduce((s, v) => s + v.weight, 0);
  return wrong / total;
}

/**
 * Diff machine belief against ground truth and rank the gaps by impact.
 * Attributes where machines already agree with the truth produce no gap.
 */
export function findLegibilityGaps(
  graph: EntityGraph,
  registry: GroundTruthRegistry,
): LegibilityGap[] {
  const attributes = new Set<string>();
  for (const b of graph.beliefs) attributes.add(norm(b.attribute));
  for (const f of registry.facts) attributes.add(norm(f.attribute));

  const gaps: LegibilityGap[] = [];

  for (const attrKey of attributes) {
    const belief = graph.beliefs.find((b) => norm(b.attribute) === attrKey);
    const fact = registry.facts.find((f) => norm(f.attribute) === attrKey);
    const attribute = fact?.attribute ?? belief?.attribute ?? attrKey;
    const category: FactCategory = fact?.category ?? "other";
    const contested = belief?.contested ?? false;
    let wrongReach = 0;

    let kind: GapKind;
    let correctable: boolean;
    let rationale: string;

    if (fact && belief) {
      if (norm(fact.value) === norm(belief.value)) continue; // aligned — no gap
      kind = "mismatch";
      wrongReach = wrongReachShare(belief.variants, fact.value);
      correctable = isPubliclyUsable(fact);
      rationale = correctable
        ? `Machines say "${belief.value}" but the verified value is "${fact.value}". Correct the record with the sourced fact.`
        : `Machines say "${belief.value}" but the verified value is "${fact.value}"; substantiate the fact with a source before correcting (loops to Frontier 3).`;
    } else if (fact && !belief) {
      kind = "missing";
      correctable = isPubliclyUsable(fact);
      rationale = correctable
        ? `Machines hold no belief about ${attribute}; publish the sourced fact "${fact.value}" so they can.`
        : `Machines hold no belief about ${attribute}; substantiate "${fact.value}" with a source before publishing (loops to Frontier 3).`;
    } else {
      // belief only — cannot verify against truth.
      kind = "unconfirmed";
      correctable = false;
      rationale = `Machines say "${belief!.value}" for ${attribute}, but there is no verified fact to confirm or refute it. Verify it in the registry first.`;
    }

    gaps.push({
      attribute,
      kind,
      machineBelief: belief?.value,
      truth: fact?.value,
      contested,
      correctable,
      impact: scoreImpact(category, kind, contested, wrongReach),
      category,
      rationale,
    });
  }

  gaps.sort((a, b) => b.impact - a.impact || a.attribute.localeCompare(b.attribute));
  return gaps;
}
