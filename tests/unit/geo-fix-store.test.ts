import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findIntervention,
  loadInterventions,
  loadLifts,
  saveIntervention,
  saveLift,
} from "@/lib/engines/geo-fix-store";
import type { InterventionRecord } from "@/lib/engines/geo-intervention";
import type { CitationLift } from "@/lib/engines/geo-lift";

const prev = process.env.OPENGROWTH_DATA_DIR;

beforeAll(() => {
  process.env.OPENGROWTH_DATA_DIR = mkdtempSync(join(tmpdir(), "geofixstore-"));
});
afterAll(() => {
  process.env.OPENGROWTH_DATA_DIR = prev;
});

function intervention(id: string, fixId = "fix-faq-block"): InterventionRecord {
  return {
    id,
    assetId: `asset-${id}`,
    fixId,
    fixTypeId: "faq-block",
    feature: "hasFaqStructure",
    affectedPrompts: ["p1"],
    shippedAt: "2026-07-25T00:00:00.000Z",
    baseline: { runId: "b", targetPromptCount: 1, answered: 1, brandCited: 0, citedShare: 0 },
  };
}

function lift(fixId: string): CitationLift {
  return {
    fixId,
    feature: "hasFaqStructure",
    affectedPrompts: ["p1"],
    baseline: { answered: 4, brandCited: 0, citedShare: 0 },
    post: { answered: 4, brandCited: 3, citedShare: 0.75 },
    deltaShare: 0.75,
    postInterval: null,
    pValue: 0.01,
    significant: true,
    label: "directional",
    note: "",
  };
}

describe("geo fix-outcome store", () => {
  it("persists and loads interventions per domain", () => {
    saveIntervention("acme.invalid", intervention("i1"));
    saveIntervention("acme.invalid", intervention("i2"));
    expect(loadInterventions("acme.invalid").map((i) => i.id)).toEqual(["i1", "i2"]);
    expect(loadInterventions("other.invalid")).toEqual([]);
  });

  it("normalizes the domain key (www / scheme)", () => {
    saveIntervention("https://www.keyed.invalid/", intervention("k1"));
    expect(findIntervention("keyed.invalid", "k1")?.id).toBe("k1");
  });

  it("replaces an intervention with the same id rather than duplicating", () => {
    saveIntervention("dedup.invalid", intervention("d1", "fix-a"));
    saveIntervention("dedup.invalid", intervention("d1", "fix-b"));
    const all = loadInterventions("dedup.invalid");
    expect(all).toHaveLength(1);
    expect(all[0].fixId).toBe("fix-b");
  });

  it("persists lifts and replaces by fixId", () => {
    saveLift("lift.invalid", lift("fix-1"));
    saveLift("lift.invalid", lift("fix-2"));
    saveLift("lift.invalid", { ...lift("fix-1"), deltaShare: 0.9 });
    const lifts = loadLifts("lift.invalid");
    expect(lifts).toHaveLength(2);
    expect(lifts.find((l) => l.fixId === "fix-1")!.deltaShare).toBe(0.9);
  });

  it("keeps interventions and lifts in separate lists for a domain", () => {
    saveIntervention("mix.invalid", intervention("m1"));
    saveLift("mix.invalid", lift("fix-m"));
    expect(loadInterventions("mix.invalid")).toHaveLength(1);
    expect(loadLifts("mix.invalid")).toHaveLength(1);
  });
});
