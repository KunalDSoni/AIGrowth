import { describe, expect, it } from "vitest";
import { buildCitationLedger } from "@/lib/engines/geo-citation-ledger";
import type { GeoCitation, GeoObservation, GeoResult } from "@/lib/analyze/types";

function citation(domain: string, classification: GeoCitation["classification"]): GeoCitation {
  return { url: `https://${domain}/x`, domain, classification };
}

function obs(partial: Partial<GeoObservation> & { id: string; prompt: string }): GeoObservation {
  return {
    rawResponse: "answered",
    brandMentioned: false,
    citations: [],
    ...partial,
  };
}

function geoOf(observations: GeoObservation[]): GeoResult {
  return {
    runId: "run-1",
    model: "fake-model",
    sampleSize: observations.filter((o) => !o.error && o.rawResponse).length,
    brandMentionRate: 0,
    firstPartyCitationShare: 0,
    observations,
    errors: [],
    cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 },
  };
}

describe("buildCitationLedger", () => {
  it("classifies a first-party citation as cited", () => {
    const geo = geoOf([
      obs({ id: "a", prompt: "p1", brandMentioned: true, citations: [citation("brand.com", "first-party")] }),
    ]);
    const ledger = buildCitationLedger(geo);
    expect(ledger.records[0].status).toBe("cited");
    expect(ledger.records[0].brandCited).toBe(true);
  });

  it("classifies a named-but-uncited brand as mentioned-not-cited", () => {
    const geo = geoOf([
      obs({ id: "a", prompt: "p1", brandMentioned: true, citations: [citation("rival.com", "other")] }),
    ]);
    const ledger = buildCitationLedger(geo);
    expect(ledger.records[0].status).toBe("mentioned-not-cited");
    expect(ledger.records[0].brandCited).toBe(false);
  });

  it("classifies neither mention nor citation as absent", () => {
    const geo = geoOf([obs({ id: "a", prompt: "p1", brandMentioned: false, citations: [] })]);
    expect(buildCitationLedger(geo).records[0].status).toBe("absent");
  });

  it("classifies an errored probe as unanswered and excludes it from sampleSize", () => {
    const geo = geoOf([
      obs({ id: "a", prompt: "p1", brandMentioned: true, rawResponse: "", error: "429 quota" }),
      obs({ id: "b", prompt: "p2", brandMentioned: true, citations: [citation("brand.com", "first-party")] }),
    ]);
    const ledger = buildCitationLedger(geo);
    expect(ledger.records[0].status).toBe("unanswered");
    expect(ledger.sampleSize).toBe(1);
  });

  it("dedupes a competitor domain within one prompt", () => {
    const geo = geoOf([
      obs({
        id: "a",
        prompt: "p1",
        citations: [citation("rival.com", "other"), citation("rival.com", "other")],
      }),
    ]);
    const ledger = buildCitationLedger(geo);
    expect(ledger.records[0].competitorDomains).toEqual(["rival.com"]);
    expect(ledger.competitorFrequency).toEqual([{ domain: "rival.com", count: 1 }]);
  });

  it("orders competitorFrequency by count desc then domain asc", () => {
    const geo = geoOf([
      obs({ id: "a", prompt: "p1", citations: [citation("b.com", "other")] }),
      obs({ id: "b", prompt: "p2", citations: [citation("a.com", "other"), citation("b.com", "other")] }),
      obs({ id: "c", prompt: "p3", citations: [citation("a.com", "other")] }),
    ]);
    const ledger = buildCitationLedger(geo);
    expect(ledger.competitorFrequency).toEqual([
      { domain: "a.com", count: 2 },
      { domain: "b.com", count: 2 },
    ]);
  });

  it("coverage counts sum to records.length", () => {
    const geo = geoOf([
      obs({ id: "a", prompt: "p1", brandMentioned: true, citations: [citation("brand.com", "first-party")] }),
      obs({ id: "b", prompt: "p2", brandMentioned: true }),
      obs({ id: "c", prompt: "p3" }),
      obs({ id: "d", prompt: "p4", rawResponse: "", error: "timeout" }),
    ]);
    const ledger = buildCitationLedger(geo);
    const { cited, mentionedNotCited, absent, unanswered } = ledger.coverage;
    expect(cited + mentionedNotCited + absent + unanswered).toBe(ledger.records.length);
    expect(ledger.coverage).toEqual({ cited: 1, mentionedNotCited: 1, absent: 1, unanswered: 1 });
  });

  it("flags reliable only at or above MIN_SAMPLE (3)", () => {
    const two = geoOf([obs({ id: "a", prompt: "p1" }), obs({ id: "b", prompt: "p2" })]);
    const three = geoOf([obs({ id: "a", prompt: "p1" }), obs({ id: "b", prompt: "p2" }), obs({ id: "c", prompt: "p3" })]);
    expect(buildCitationLedger(two).reliable).toBe(false);
    expect(buildCitationLedger(three).reliable).toBe(true);
  });

  it("handles an all-errored geo without throwing", () => {
    const geo = geoOf([
      obs({ id: "a", prompt: "p1", rawResponse: "", error: "429" }),
      obs({ id: "b", prompt: "p2", rawResponse: "", error: "429" }),
    ]);
    const ledger = buildCitationLedger(geo);
    expect(ledger.sampleSize).toBe(0);
    expect(ledger.reliable).toBe(false);
    expect(ledger.records).toHaveLength(2);
  });

  it("passes evidenceIds through and does not mutate input", () => {
    const geo = geoOf([obs({ id: "a", prompt: "p1" })]);
    const snapshot = JSON.stringify(geo);
    const ledger = buildCitationLedger(geo, { evidenceIds: ["ev-1", "ev-2"] });
    expect(ledger.evidenceIds).toEqual(["ev-1", "ev-2"]);
    expect(JSON.stringify(geo)).toBe(snapshot);
  });
});
