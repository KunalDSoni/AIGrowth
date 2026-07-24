import { describe, expect, it } from "vitest";
import { buildCrossEngineLedger } from "@/lib/engines/geo-cross-engine-ledger";
import type { EngineGeoResult } from "@/lib/engines/geo-multi-engine";
import type { GeoObservation, GeoResult } from "@/lib/analyze/types";

function obs(id: string, cited: boolean, competitor?: string): GeoObservation {
  return {
    id,
    prompt: id,
    rawResponse: "answer",
    brandMentioned: cited,
    citations: [
      ...(cited ? [{ url: "https://brand.invalid/x", domain: "brand.invalid", classification: "first-party" as const }] : []),
      ...(competitor ? [{ url: `https://${competitor}/x`, domain: competitor, classification: "other" as const }] : []),
    ],
  };
}

function geo(observations: GeoObservation[]): GeoResult {
  return {
    runId: "r",
    model: "m",
    sampleSize: observations.filter((o) => o.rawResponse).length,
    brandMentionRate: 0,
    firstPartyCitationShare: 0,
    observations,
    errors: [],
    cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 },
  };
}

const result = (engine: string, geoResult: GeoResult, error?: string): EngineGeoResult => ({
  engine,
  measurement: "measured",
  geo: geoResult,
  ...(error ? { error } : {}),
});

describe("buildCrossEngineLedger", () => {
  it("assigns covered / absent / unmeasured states per engine", () => {
    const cross = buildCrossEngineLedger([
      result("perplexity", geo([obs("p1", true), obs("p2", true, "a.com")])),
      result("openai", geo([obs("p1", false, "a.com"), obs("p2", false, "b.com")])),
      result("broken", geo([]), "down"),
    ]);
    expect(cross.enginesCovered).toEqual(["perplexity"]);
    expect(cross.enginesAbsent).toEqual(["openai"]);
    expect(cross.enginesUnmeasured).toEqual(["broken"]);
    expect(cross.engines.find((e) => e.engine === "perplexity")!.state).toBe("covered");
  });

  it("merges the competitor union with per-engine attribution and summed counts", () => {
    const cross = buildCrossEngineLedger([
      result("openai", geo([obs("p1", false, "a.com")])),
      result("perplexity", geo([obs("p1", false, "a.com"), obs("p2", false, "b.com")])),
    ]);
    const a = cross.competitorUnion.find((c) => c.domain === "a.com")!;
    expect(a.engines.sort()).toEqual(["openai", "perplexity"]);
    expect(a.totalCount).toBe(2);
    const b = cross.competitorUnion.find((c) => c.domain === "b.com")!;
    expect(b.engines).toEqual(["perplexity"]);
    expect(b.totalCount).toBe(1);
  });

  it("orders the competitor union by total count then domain", () => {
    const cross = buildCrossEngineLedger([
      result("e1", geo([obs("p1", false, "a.com"), obs("p2", false, "a.com")])),
      result("e2", geo([obs("p1", false, "b.com")])),
    ]);
    expect(cross.competitorUnion.map((c) => c.domain)).toEqual(["a.com", "b.com"]);
  });

  it("pools cited share across engines and flags reliability", () => {
    const cross = buildCrossEngineLedger([
      result("openai", geo([obs("p1", true), obs("p2", false, "a.com")])),
    ]);
    expect(cross.overallCitedShare).toBe(0.5);
    expect(cross.reliable).toBe(false); // n=2 < 3
  });

  it("is reliable when at least one engine clears its sample threshold", () => {
    const big = geo(Array.from({ length: 4 }, (_, i) => obs(`p${i}`, i === 0)));
    const cross = buildCrossEngineLedger([result("openai", big)]);
    expect(cross.reliable).toBe(true);
  });
});
