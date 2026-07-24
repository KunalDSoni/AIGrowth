import { describe, expect, it } from "vitest";
import { measureFixLift } from "@/lib/engines/geo-measure-lift";
import type { GeoObservation, GeoResult } from "@/lib/analyze/types";
import type { InterventionRecord } from "@/lib/engines/geo-intervention";

function intervention(): InterventionRecord {
  return {
    id: "intervention-1",
    assetId: "asset-1",
    fixId: "fix-faq-block",
    fixTypeId: "faq-block",
    feature: "hasFaqStructure",
    affectedPrompts: ["obs-0", "obs-1", "obs-2", "obs-3"],
    shippedAt: "2026-07-25T00:00:00.000Z",
    baseline: { runId: "b", targetPromptCount: 4, answered: 4, brandCited: 0, citedShare: 0 },
  };
}

// Re-probe observations carry FRESH ids (not obs-*), simulating a real re-run.
function obs(cited: boolean, i: number): GeoObservation {
  return {
    id: `geo-measure-123-${i}-abc`,
    prompt: `Question ${i}`,
    rawResponse: "answer",
    brandMentioned: cited,
    citations: cited ? [{ url: "https://brand.com/x", domain: "brand.com", classification: "first-party" }] : [],
  };
}

function geoResult(citedCount: number): GeoResult {
  const observations = [0, 1, 2, 3].map((i) => obs(i < citedCount, i));
  return {
    runId: "geo-measure-123",
    model: "m",
    sampleSize: 4,
    brandMentionRate: 0,
    firstPartyCitationShare: 0,
    observations,
    errors: [],
    cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 },
  };
}

describe("measureFixLift", () => {
  it("re-keys fresh re-probe ids to the affected prompts and attributes a causal lift", () => {
    const lift = measureFixLift({
      intervention: intervention(),
      orderedPromptIds: ["obs-0", "obs-1", "obs-2", "obs-3"],
      geoResult: geoResult(4),
      controlled: true,
    });
    expect(lift.post.answered).toBe(4);
    expect(lift.post.brandCited).toBe(4);
    expect(lift.deltaShare).toBe(1);
    expect(lift.label).toBe("causal");
  });

  it("labels the same significant lift directional without a control", () => {
    const lift = measureFixLift({
      intervention: intervention(),
      orderedPromptIds: ["obs-0", "obs-1", "obs-2", "obs-3"],
      geoResult: geoResult(4),
    });
    expect(lift.label).toBe("directional");
  });

  it("reports no lift (insufficient) when the re-probe still doesn't cite the brand", () => {
    const lift = measureFixLift({
      intervention: intervention(),
      orderedPromptIds: ["obs-0", "obs-1", "obs-2", "obs-3"],
      geoResult: geoResult(0),
      controlled: true,
    });
    expect(lift.post.brandCited).toBe(0);
    expect(lift.label).toBe("insufficient");
  });
});
