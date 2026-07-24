/**
 * MLE-2 — Entity Graph Builder (Machine Legibility Engine, Frontier 4).
 *
 * Assembles the machine's mental model of the brand — "who the machines think
 * you are" — from belief signals gathered across sources: LLM answer-engine
 * probes (the existing GEO stack), knowledge panels, Wikidata, on-site schema,
 * review sites, and Reddit. Signals for the same attribute often disagree; the
 * builder surfaces that disagreement rather than hiding it, so the Gap Finder
 * (MLE-3) can diff a *consensus with known confidence* against ground truth.
 *
 * Pure aggregation over already-collected signals — the probing itself belongs
 * to the GEO stack, which produces these signals upstream.
 */

export type BeliefSource =
  | "answer-engine"
  | "knowledge-panel"
  | "wikidata"
  | "on-site-schema"
  | "review-site"
  | "reddit";

/** One thing a source asserts the machine believes about the brand. */
export interface BeliefSignal {
  attribute: string;
  value: string;
  source: BeliefSource;
  /** Override the default source authority (0..1). */
  weight?: number;
}

export interface BeliefVariant {
  value: string;
  sources: BeliefSource[];
  weight: number;
}

export interface EntityBelief {
  attribute: string;
  /** The consensus (highest-weighted) value machines hold. */
  value: string;
  /** Every distinct value seen, strongest first. */
  variants: BeliefVariant[];
  /** True when machines hold more than one distinct value for the attribute. */
  contested: boolean;
  /** 0..1 — consensus weight over total weight for the attribute. */
  confidence: number;
}

export interface EntityGraph {
  subject: string;
  beliefs: EntityBelief[];
  sources: BeliefSource[];
}

/**
 * Default authority per source — directional priors for how much a single signal
 * from that source counts. Authoritative structured sources outrank social
 * chatter; a caller can override per-signal via `weight`.
 */
export const SOURCE_AUTHORITY: Record<BeliefSource, number> = {
  "knowledge-panel": 1,
  wikidata: 1,
  "on-site-schema": 0.9,
  "answer-engine": 0.8,
  "review-site": 0.6,
  reddit: 0.4,
};

export const ENTITY_GRAPH_VERSION = 1;

const norm = (s: string) => s.trim().toLowerCase();
const round2 = (v: number) => Math.round(v * 100) / 100;

function signalWeight(s: BeliefSignal): number {
  return typeof s.weight === "number" ? s.weight : SOURCE_AUTHORITY[s.source];
}

/** Build the entity graph from belief signals. */
export function buildEntityGraph(subject: string, signals: BeliefSignal[]): EntityGraph {
  const byAttribute = new Map<string, BeliefSignal[]>();
  for (const s of signals) {
    const key = norm(s.attribute);
    const list = byAttribute.get(key) ?? [];
    list.push(s);
    byAttribute.set(key, list);
  }

  const beliefs: EntityBelief[] = [];
  for (const [, group] of byAttribute) {
    // Group by value, summing weight and collecting distinct sources.
    const byValue = new Map<string, { value: string; weight: number; sources: Set<BeliefSource> }>();
    let total = 0;
    for (const s of group) {
      const w = signalWeight(s);
      total += w;
      const vk = norm(s.value);
      const entry = byValue.get(vk) ?? { value: s.value, weight: 0, sources: new Set<BeliefSource>() };
      entry.weight += w;
      entry.sources.add(s.source);
      byValue.set(vk, entry);
    }

    const variants: BeliefVariant[] = [...byValue.values()]
      .map((v) => ({ value: v.value, sources: [...v.sources], weight: round2(v.weight) }))
      .sort((a, b) => b.weight - a.weight || a.value.localeCompare(b.value));

    const top = variants[0];
    beliefs.push({
      attribute: group[0].attribute,
      value: top.value,
      variants,
      contested: variants.length > 1,
      confidence: total > 0 ? round2(top.weight / total) : 0,
    });
  }

  beliefs.sort((a, b) => a.attribute.localeCompare(b.attribute));
  const sources = [...new Set(signals.map((s) => s.source))];

  return { subject: subject.trim(), beliefs, sources };
}

/** Convenience: look up the consensus belief for an attribute. */
export function beliefFor(graph: EntityGraph, attribute: string): EntityBelief | undefined {
  return graph.beliefs.find((b) => norm(b.attribute) === norm(attribute));
}
