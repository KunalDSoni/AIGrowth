import { describe, expect, it } from "vitest";
import {
  buildAnswerEngineLens,
  ANSWER_ENGINE_LENS_VERSION,
} from "@/lib/engines/legibility-answer-engine-lens";
import { buildEntityGraph, type BeliefSignal } from "@/lib/engines/legibility-entity-graph";
import { findLegibilityGaps } from "@/lib/engines/legibility-gap-finder";
import {
  createRegistry,
  upsertFact,
  verifyFact,
  type FactCategory,
  type GroundTruthRegistry,
} from "@/lib/engines/legibility-ground-truth";

const graphOf = (signals: BeliefSignal[]) => buildEntityGraph("Acme", signals);

const registryOf = (
  facts: { attribute: string; value: string; category: FactCategory; sourced?: boolean }[],
): GroundTruthRegistry => {
  let reg = createRegistry("Acme");
  facts.forEach((f, i) => {
    reg = upsertFact(
      reg,
      verifyFact({
        id: `t${i}`,
        subject: "Acme",
        attribute: f.attribute,
        value: f.value,
        category: f.category,
        verifiedBy: "kunal",
        sourceUrl: f.sourced === false ? undefined : "https://acme.com",
      }),
    );
  });
  return reg;
};

describe("legibility answer-engine lens", () => {
  it("exposes a version", () => {
    expect(ANSWER_ENGINE_LENS_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("routes a knowledge-panel mismatch to wikidata/wikipedia plus on-site schema", () => {
    const graph = graphOf([{ attribute: "category", value: "crm", source: "knowledge-panel" }]);
    const gaps = findLegibilityGaps(graph, registryOf([{ attribute: "category", value: "invoicing software", category: "category" }]));
    const report = buildAnswerEngineLens({ graph, gaps });
    const item = report.items[0];
    expect(item.channels).toContain("on-site-schema");
    expect(item.channels).toContain("wikidata");
    expect(item.channels).toContain("wikipedia");
    expect(item.correctable).toBe(true);
  });

  it("routes a review-site mismatch to review-sites", () => {
    const graph = graphOf([{ attribute: "price", value: "$99", source: "review-site" }]);
    const gaps = findLegibilityGaps(graph, registryOf([{ attribute: "price", value: "$20", category: "price" }]));
    const report = buildAnswerEngineLens({ graph, gaps });
    expect(report.items[0].channels).toContain("review-sites");
  });

  it("routes a missing fact to on-site schema and wikidata", () => {
    const graph = graphOf([]);
    const gaps = findLegibilityGaps(graph, registryOf([{ attribute: "offering", value: "free tier", category: "offering" }]));
    const report = buildAnswerEngineLens({ graph, gaps });
    expect(report.items[0].gapKind).toBe("missing");
    expect(report.items[0].channels.sort()).toEqual(["on-site-schema", "wikidata"]);
  });

  it("gives an unconfirmed gap no channels and a verify-first rationale", () => {
    const graph = graphOf([{ attribute: "founded", value: "2015", source: "reddit" }]);
    const gaps = findLegibilityGaps(graph, registryOf([]));
    const report = buildAnswerEngineLens({ graph, gaps });
    expect(report.items[0].channels).toEqual([]);
    expect(report.items[0].correctable).toBe(false);
    expect(report.items[0].rationale).toMatch(/verify it in the registry/i);
  });

  it("makes an unsourced-truth gap correctable when a Frontier-3 study substantiates it", () => {
    const graph = graphOf([{ attribute: "price", value: "$99", source: "answer-engine" }]);
    // Truth exists but has no registry source → gap.correctable is false...
    const gaps = findLegibilityGaps(
      graph,
      registryOf([{ attribute: "price", value: "$20", category: "price", sourced: false }]),
    );
    expect(gaps[0].correctable).toBe(false);
    // ...until a published study supplies the source.
    const report = buildAnswerEngineLens({
      graph,
      gaps,
      supportingFacts: [{ attribute: "price", sourceStudyId: "study-1" }],
    });
    expect(report.items[0].correctable).toBe(true);
    expect(report.items[0].fueledByStudy).toBe("study-1");
    expect(report.items[0].channels).toContain("primary-source");
  });

  it("counts correctable items", () => {
    const graph = graphOf([
      { attribute: "price", value: "$99", source: "answer-engine" },
      { attribute: "founded", value: "2015", source: "reddit" },
    ]);
    const gaps = findLegibilityGaps(
      graph,
      registryOf([{ attribute: "price", value: "$20", category: "price" }]),
    );
    const report = buildAnswerEngineLens({ graph, gaps });
    // price mismatch is correctable; founded is unconfirmed (not correctable).
    expect(report.correctableCount).toBe(1);
  });
});
