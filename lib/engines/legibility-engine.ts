/**
 * MLE-7 — Machine Legibility Engine orchestration (Frontier 4).
 *
 * Composes the shared entity core and both lenses into one report: build the
 * machine's belief graph (MLE-2), diff it against verified truth (MLE-3), route
 * corrections through the answer-engine lens (MLE-4), audit product buyability
 * through the shopping-agent lens (MLE-5), score legibility, and draft a
 * human-gated correction playbook (MLE-6).
 *
 * Pure over its inputs — belief signals, the ground-truth registry, and an
 * optional product feed item. It fabricates nothing: with no signals and no
 * facts, it returns an honest empty report.
 */

import {
  buildEntityGraph,
  type BeliefSignal,
  type EntityGraph,
} from "@/lib/engines/legibility-entity-graph";
import {
  findLegibilityGaps,
  type LegibilityGap,
} from "@/lib/engines/legibility-gap-finder";
import { type GroundTruthRegistry } from "@/lib/engines/legibility-ground-truth";
import {
  buildAnswerEngineLens,
  type AnswerEngineLensReport,
} from "@/lib/engines/legibility-answer-engine-lens";
import {
  buildShoppingAgentLens,
  type ProductFeedItem,
  type ShoppingAgentReport,
} from "@/lib/engines/legibility-shopping-agent-lens";
import {
  buildLegibilityScore,
  type LegibilityScore,
} from "@/lib/engines/legibility-score";
import {
  buildCorrectionPlaybook,
  type CorrectionPlaybook,
} from "@/lib/engines/legibility-playbook";

export interface LegibilityReport {
  subject: string;
  graph: EntityGraph;
  gaps: LegibilityGap[];
  answerLens: AnswerEngineLensReport;
  shopping?: ShoppingAgentReport;
  score: LegibilityScore;
  playbook: CorrectionPlaybook;
  /** True when there is nothing to measure yet (no beliefs and no facts). */
  empty: boolean;
}

export const LEGIBILITY_ENGINE_VERSION = 1;

export function buildLegibilityReport(input: {
  subject: string;
  signals: BeliefSignal[];
  groundTruth: GroundTruthRegistry;
  supportingFacts?: { attribute: string; sourceStudyId: string }[];
  product?: ProductFeedItem;
  hasStructuredEndpoint?: boolean;
}): LegibilityReport {
  const graph = buildEntityGraph(input.subject, input.signals);
  const gaps = findLegibilityGaps(graph, input.groundTruth);
  const answerLens = buildAnswerEngineLens({
    graph,
    gaps,
    supportingFacts: input.supportingFacts,
  });
  const shopping = input.product
    ? buildShoppingAgentLens(input.product, { hasStructuredEndpoint: input.hasStructuredEndpoint })
    : undefined;
  const score = buildLegibilityScore({
    gaps,
    beliefsMeasured: graph.beliefs.length,
    shopping,
  });
  const playbook = buildCorrectionPlaybook(answerLens);

  return {
    subject: input.subject,
    graph,
    gaps,
    answerLens,
    shopping,
    score,
    playbook,
    empty: graph.beliefs.length === 0 && input.groundTruth.facts.length === 0,
  };
}
