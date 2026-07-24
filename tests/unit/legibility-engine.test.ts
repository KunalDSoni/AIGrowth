import { describe, expect, it } from "vitest";
import {
  buildLegibilityReport,
  LEGIBILITY_ENGINE_VERSION,
} from "@/lib/engines/legibility-engine";
import { type BeliefSignal } from "@/lib/engines/legibility-entity-graph";
import { createRegistry, upsertFact, verifyFact } from "@/lib/engines/legibility-ground-truth";

const registry = () => {
  let reg = createRegistry("Acme");
  reg = upsertFact(
    reg,
    verifyFact({
      id: "t1",
      subject: "Acme",
      attribute: "price",
      value: "$20/mo",
      category: "price",
      verifiedBy: "kunal",
      sourceUrl: "https://acme.com/pricing",
    }),
  );
  return reg;
};

const signals: BeliefSignal[] = [
  { attribute: "price", value: "$50/mo", source: "answer-engine" },
  { attribute: "category", value: "invoicing software", source: "wikidata" },
];

describe("legibility engine orchestration", () => {
  it("exposes a version", () => {
    expect(LEGIBILITY_ENGINE_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("composes graph, gaps, lens, score, and playbook end to end", () => {
    const report = buildLegibilityReport({ subject: "Acme", signals, groundTruth: registry() });
    expect(report.graph.beliefs).toHaveLength(2);
    // price mismatch is the one gap (category has no truth → unconfirmed also a gap)
    expect(report.gaps.some((g) => g.attribute === "price" && g.kind === "mismatch")).toBe(true);
    expect(report.playbook.drafts.some((d) => d.attribute === "price")).toBe(true);
    expect(report.score.overall).toBeLessThan(100);
    expect(report.empty).toBe(false);
  });

  it("includes the shopping lens when a product is provided", () => {
    const report = buildLegibilityReport({
      subject: "Acme",
      signals,
      groundTruth: registry(),
      product: { id: "p1", name: "Acme Pro", price: 20, currency: "USD", availability: "in_stock", url: "https://acme.com/p" },
      hasStructuredEndpoint: true,
    });
    expect(report.shopping).toBeDefined();
    expect(typeof report.score.shoppingAgent).toBe("number");
  });

  it("returns an honest empty report with no signals and no facts", () => {
    const report = buildLegibilityReport({
      subject: "Acme",
      signals: [],
      groundTruth: createRegistry("Acme"),
    });
    expect(report.empty).toBe(true);
    expect(report.gaps).toEqual([]);
    expect(report.score.answerEngine).toBe(100);
  });

  it("threads a supporting study through to a correctable draft", () => {
    let reg = createRegistry("Acme");
    // Truth exists but unsourced → not correctable from registry alone.
    reg = upsertFact(
      reg,
      verifyFact({ id: "t1", subject: "Acme", attribute: "price", value: "$20/mo", category: "price", verifiedBy: "kunal" }),
    );
    const report = buildLegibilityReport({
      subject: "Acme",
      signals: [{ attribute: "price", value: "$50/mo", source: "answer-engine" }],
      groundTruth: reg,
      supportingFacts: [{ attribute: "price", sourceStudyId: "study-1" }],
    });
    const draft = report.playbook.drafts.find((d) => d.attribute === "price");
    expect(draft?.fueledByStudy).toBe("study-1");
  });
});
