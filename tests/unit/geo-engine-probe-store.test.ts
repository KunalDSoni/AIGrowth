import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEngineProbes, saveEngineProbes } from "@/lib/engines/geo-engine-probe-store";
import type { EngineGeoResult } from "@/lib/engines/geo-multi-engine";
import type { GeoResult } from "@/lib/analyze/types";

const prev = process.env.OPENGROWTH_DATA_DIR;
beforeAll(() => {
  process.env.OPENGROWTH_DATA_DIR = mkdtempSync(join(tmpdir(), "probestore-"));
});
afterAll(() => {
  process.env.OPENGROWTH_DATA_DIR = prev;
});

function geo(): GeoResult {
  return {
    runId: "r",
    model: "m",
    sampleSize: 2,
    brandMentionRate: 0,
    firstPartyCitationShare: 0,
    observations: [{ id: "o1", prompt: "p1", rawResponse: "a", brandMentioned: false, citations: [] }],
    errors: [],
    cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 },
  };
}

const result = (engine: string): EngineGeoResult => ({ engine, measurement: "measured", geo: geo() });

describe("geo engine-probe store", () => {
  it("persists and loads per-engine probes by domain", () => {
    saveEngineProbes("acme.invalid", [result("openai"), result("perplexity")]);
    expect(loadEngineProbes("acme.invalid").map((r) => r.engine)).toEqual(["openai", "perplexity"]);
    expect(loadEngineProbes("other.invalid")).toEqual([]);
  });

  it("replaces the prior run on re-save", () => {
    saveEngineProbes("dedup.invalid", [result("openai")]);
    saveEngineProbes("dedup.invalid", [result("perplexity"), result("gemini")]);
    expect(loadEngineProbes("dedup.invalid").map((r) => r.engine)).toEqual(["perplexity", "gemini"]);
  });

  it("normalizes the domain key", () => {
    saveEngineProbes("https://www.keyed.invalid/", [result("mock")]);
    expect(loadEngineProbes("keyed.invalid").map((r) => r.engine)).toEqual(["mock"]);
  });
});
