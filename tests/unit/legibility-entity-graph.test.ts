import { describe, expect, it } from "vitest";
import {
  buildEntityGraph,
  beliefFor,
  SOURCE_AUTHORITY,
  ENTITY_GRAPH_VERSION,
  type BeliefSignal,
} from "@/lib/engines/legibility-entity-graph";

describe("legibility entity graph builder", () => {
  it("exposes a version", () => {
    expect(ENTITY_GRAPH_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("builds a consensus belief from agreeing signals", () => {
    const signals: BeliefSignal[] = [
      { attribute: "category", value: "invoicing software", source: "answer-engine" },
      { attribute: "category", value: "invoicing software", source: "wikidata" },
    ];
    const g = buildEntityGraph("Acme", signals);
    const b = beliefFor(g, "category")!;
    expect(b.value).toBe("invoicing software");
    expect(b.contested).toBe(false);
    expect(b.confidence).toBe(1);
  });

  it("flags a contested attribute and picks the highest-weighted value as consensus", () => {
    const signals: BeliefSignal[] = [
      { attribute: "category", value: "billing tool", source: "reddit" }, // weight 0.4
      { attribute: "category", value: "invoicing software", source: "knowledge-panel" }, // weight 1.0
    ];
    const b = beliefFor(buildEntityGraph("Acme", signals), "category")!;
    expect(b.contested).toBe(true);
    expect(b.value).toBe("invoicing software");
    expect(b.confidence).toBeGreaterThan(0.5);
    expect(b.variants).toHaveLength(2);
  });

  it("weights sources by authority (knowledge panel > reddit)", () => {
    expect(SOURCE_AUTHORITY["knowledge-panel"]).toBeGreaterThan(SOURCE_AUTHORITY["reddit"]);
  });

  it("respects a per-signal weight override", () => {
    const signals: BeliefSignal[] = [
      { attribute: "price", value: "$10/mo", source: "reddit", weight: 5 },
      { attribute: "price", value: "$20/mo", source: "knowledge-panel" },
    ];
    const b = beliefFor(buildEntityGraph("Acme", signals), "price")!;
    expect(b.value).toBe("$10/mo");
  });

  it("collects the distinct sources supporting each variant", () => {
    const signals: BeliefSignal[] = [
      { attribute: "category", value: "invoicing software", source: "answer-engine" },
      { attribute: "category", value: "invoicing software", source: "on-site-schema" },
    ];
    const b = beliefFor(buildEntityGraph("Acme", signals), "category")!;
    expect(b.variants[0].sources.sort()).toEqual(["answer-engine", "on-site-schema"]);
  });

  it("normalises attribute and value casing when aggregating", () => {
    const signals: BeliefSignal[] = [
      { attribute: "Category", value: "Invoicing Software", source: "answer-engine" },
      { attribute: "category", value: "invoicing software", source: "wikidata" },
    ];
    const g = buildEntityGraph("Acme", signals);
    expect(g.beliefs).toHaveLength(1);
    expect(beliefFor(g, "category")!.contested).toBe(false);
  });

  it("reports the contributing sources on the graph", () => {
    const g = buildEntityGraph("Acme", [
      { attribute: "category", value: "x", source: "answer-engine" },
      { attribute: "price", value: "y", source: "review-site" },
    ]);
    expect(g.sources.sort()).toEqual(["answer-engine", "review-site"]);
    expect(g.beliefs).toHaveLength(2);
  });

  it("returns an empty graph for no signals", () => {
    const g = buildEntityGraph("Acme", []);
    expect(g.beliefs).toEqual([]);
    expect(g.sources).toEqual([]);
  });
});
