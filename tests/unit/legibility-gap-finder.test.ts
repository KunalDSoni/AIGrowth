import { describe, expect, it } from "vitest";
import { findLegibilityGaps, GAP_FINDER_VERSION } from "@/lib/engines/legibility-gap-finder";
import { buildEntityGraph, type BeliefSignal } from "@/lib/engines/legibility-entity-graph";
import {
  createRegistry,
  upsertFact,
  verifyFact,
  type GroundTruthRegistry,
} from "@/lib/engines/legibility-ground-truth";

const graphOf = (signals: BeliefSignal[]) => buildEntityGraph("Acme", signals);

const registryOf = (
  facts: { attribute: string; value: string; category: Parameters<typeof verifyFact>[0]["category"]; sourced?: boolean }[],
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
        sourceUrl: f.sourced === false ? undefined : "https://acme.com/about",
      }),
    );
  });
  return reg;
};

describe("legibility gap finder", () => {
  it("exposes a version", () => {
    expect(GAP_FINDER_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("finds a mismatch when machines contradict a sourced truth", () => {
    const gaps = findLegibilityGaps(
      graphOf([{ attribute: "price", value: "$50/mo", source: "answer-engine" }]),
      registryOf([{ attribute: "price", value: "$20/mo", category: "price" }]),
    );
    expect(gaps).toHaveLength(1);
    expect(gaps[0].kind).toBe("mismatch");
    expect(gaps[0].correctable).toBe(true);
    expect(gaps[0].machineBelief).toBe("$50/mo");
    expect(gaps[0].truth).toBe("$20/mo");
  });

  it("produces no gap when machines already agree with the truth", () => {
    const gaps = findLegibilityGaps(
      graphOf([{ attribute: "category", value: "invoicing software", source: "wikidata" }]),
      registryOf([{ attribute: "category", value: "Invoicing Software", category: "category" }]),
    );
    expect(gaps).toHaveLength(0);
  });

  it("finds a missing gap when the truth is verified but machines are silent", () => {
    const gaps = findLegibilityGaps(
      graphOf([]),
      registryOf([{ attribute: "offering", value: "free tier", category: "offering" }]),
    );
    expect(gaps[0].kind).toBe("missing");
    expect(gaps[0].correctable).toBe(true);
  });

  it("marks an unverifiable machine belief as unconfirmed and not correctable", () => {
    const gaps = findLegibilityGaps(
      graphOf([{ attribute: "founded", value: "2015", source: "reddit" }]),
      registryOf([]),
    );
    expect(gaps[0].kind).toBe("unconfirmed");
    expect(gaps[0].correctable).toBe(false);
    expect(gaps[0].rationale).toMatch(/verify it in the registry/i);
  });

  it("refuses to mark a mismatch correctable when the truth fact has no source", () => {
    const gaps = findLegibilityGaps(
      graphOf([{ attribute: "price", value: "$50/mo", source: "answer-engine" }]),
      registryOf([{ attribute: "price", value: "$20/mo", category: "price", sourced: false }]),
    );
    expect(gaps[0].kind).toBe("mismatch");
    expect(gaps[0].correctable).toBe(false);
    expect(gaps[0].rationale).toMatch(/frontier 3/i);
  });

  it("ranks a high-commercial-impact mismatch above a low one", () => {
    const gaps = findLegibilityGaps(
      graphOf([
        { attribute: "price", value: "$50/mo", source: "answer-engine" },
        { attribute: "founded", value: "2010", source: "answer-engine" },
      ]),
      registryOf([
        { attribute: "price", value: "$20/mo", category: "price" },
        { attribute: "founded", value: "2020", category: "other" },
      ]),
    );
    expect(gaps.map((g) => g.attribute)).toEqual(["price", "founded"]);
    expect(gaps[0].impact).toBeGreaterThan(gaps[1].impact);
  });

  it("raises impact when machines are contested on the attribute", () => {
    const contested = findLegibilityGaps(
      graphOf([
        { attribute: "category", value: "billing tool", source: "reddit" },
        { attribute: "category", value: "crm", source: "review-site" },
      ]),
      registryOf([{ attribute: "category", value: "invoicing software", category: "category" }]),
    );
    const clean = findLegibilityGaps(
      graphOf([{ attribute: "category", value: "billing tool", source: "reddit" }]),
      registryOf([{ attribute: "category", value: "invoicing software", category: "category" }]),
    );
    expect(contested[0].contested).toBe(true);
    expect(contested[0].impact).toBeGreaterThan(clean[0].impact);
  });

  it("returns no gaps for empty belief and empty registry", () => {
    expect(findLegibilityGaps(graphOf([]), registryOf([]))).toEqual([]);
  });
});
