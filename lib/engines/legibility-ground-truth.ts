/**
 * MLE-1 — Ground Truth Registry (Machine Legibility Engine, Frontier 4).
 *
 * The account's human-verified facts about itself — the source of truth the
 * engine diffs machine belief against. Everything downstream (Gap Finder,
 * Correction Playbook) trusts this registry, so two integrity rules are enforced
 * at the type/function boundary, not by convention:
 *
 *  1. A fact enters the registry only with a named human verifier. Ground truth
 *     is never anonymous or machine-asserted.
 *  2. A fact may back a *public* correction only when it carries a source
 *     (URL or note). An unsourced fact can guide internal work but can never be
 *     used to correct what a third party publishes — matching the F4 rule
 *     "ground-truth fact lacks a source → cannot be used in a public correction".
 */

export type FactCategory =
  | "category"
  | "offering"
  | "spec"
  | "price"
  | "service-area"
  | "differentiator"
  | "other";

export interface GroundTruthFact {
  id: string;
  /** The brand/entity the fact is about. */
  subject: string;
  /** What the fact describes, e.g. "category", "starting price", "founded". */
  attribute: string;
  /** The verified value. */
  value: string;
  category: FactCategory;
  /** Provenance — at least one is required for public use. */
  sourceUrl?: string;
  sourceNote?: string;
  /** The human who verified the fact. Never anonymous. */
  verifiedBy: string;
  verifiedAt: string;
}

export interface GroundTruthRegistry {
  subject: string;
  facts: GroundTruthFact[];
}

export const GROUND_TRUTH_VERSION = 1;

const norm = (s: string) => s.trim().toLowerCase();

/** A fact is publicly usable only when it carries a source (URL or note). */
export function isPubliclyUsable(fact: GroundTruthFact): boolean {
  return Boolean((fact.sourceUrl && fact.sourceUrl.trim()) || (fact.sourceNote && fact.sourceNote.trim()));
}

/**
 * Build a verified fact. Requires a named verifier and non-empty
 * subject/attribute/value — throws otherwise, so no half-specified or anonymous
 * fact can enter the registry.
 */
export function verifyFact(input: {
  id: string;
  subject: string;
  attribute: string;
  value: string;
  category: FactCategory;
  verifiedBy: string;
  sourceUrl?: string;
  sourceNote?: string;
  now?: Date;
}): GroundTruthFact {
  const verifiedBy = input.verifiedBy.trim();
  if (!verifiedBy) {
    throw new Error("A ground-truth fact requires a named verifier — facts are never anonymous.");
  }
  if (!input.subject.trim() || !input.attribute.trim() || !input.value.trim()) {
    throw new Error("A ground-truth fact requires a subject, attribute, and value.");
  }
  return {
    id: input.id,
    subject: input.subject.trim(),
    attribute: input.attribute.trim(),
    value: input.value.trim(),
    category: input.category,
    sourceUrl: input.sourceUrl?.trim() || undefined,
    sourceNote: input.sourceNote?.trim() || undefined,
    verifiedBy,
    verifiedAt: (input.now ?? new Date()).toISOString(),
  };
}

/** Create an empty registry for a subject. */
export function createRegistry(subject: string): GroundTruthRegistry {
  return { subject: subject.trim(), facts: [] };
}

/**
 * Insert or replace a fact, keyed by its (normalised) attribute — the latest
 * verified value for an attribute wins. Returns a new registry (pure).
 */
export function upsertFact(registry: GroundTruthRegistry, fact: GroundTruthFact): GroundTruthRegistry {
  const facts = registry.facts.filter((f) => norm(f.attribute) !== norm(fact.attribute));
  facts.push(fact);
  return { ...registry, facts };
}

/** Look up the current verified value for an attribute. */
export function findFact(registry: GroundTruthRegistry, attribute: string): GroundTruthFact | undefined {
  return registry.facts.find((f) => norm(f.attribute) === norm(attribute));
}

/** The subset of facts that may back a public correction. */
export function publiclyUsableFacts(registry: GroundTruthRegistry): GroundTruthFact[] {
  return registry.facts.filter(isPubliclyUsable);
}
