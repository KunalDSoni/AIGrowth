import { describe, expect, it } from "vitest";
import { runObservations, runVariance, type AIAnswerProvider } from "@/lib/engines/observation-run";
import type { AIVisibilityPromptFamily } from "@/lib/domain/types";

const family: AIVisibilityPromptFamily = {
  id: "clinic",
  topic: "Clinic bookkeeping",
  buyingStage: "decision",
  persona: "Practice manager",
  geography: "Australia",
  prompts: [
    "Who provides bookkeeping for clinics?",
    "Best clinic bookkeeping providers in Australia",
    "Should a clinic outsource bookkeeping?",
    "Clinic bookkeeping vs in-house",
  ],
};

/** Test double. The engine has no built-in provider — callers must supply one. */
const stubProvider: AIAnswerProvider = {
  name: "stub",
  answer(prompt, ctx) {
    const domain = ctx.mentionsBrand ? ctx.firstPartyDomain : "competitor.invalid";
    return {
      rawResponse: ctx.mentionsBrand
        ? `${ctx.brand} answers "${prompt}".`
        : `${ctx.competitor} answers "${prompt}".`,
      citations: [
        { url: `https://${domain}/a`, domain, title: "Source" },
        { url: "https://reference.invalid/guide", domain: "reference.invalid", title: "Reference" },
      ],
      sentiment: ctx.mentionsBrand ? "positive" : "neutral",
    };
  },
};

const base = {
  family,
  observedAt: "2026-07-23T00:00:00.000Z",
  brand: "Test Brand",
  firstPartyDomain: "example.invalid",
  competitors: ["Competitor One", "Competitor Two"],
  provider: stubProvider,
};

describe("runObservations", () => {
  it("completes with one observation per prompt and cost metadata", () => {
    const run = runObservations({ ...base, runId: "run-a", seed: 42 });
    expect(run.status).toBe("completed");
    expect(run.sampleSize).toBe(family.prompts.length);
    expect(run.observations.length).toBe(family.prompts.length);
    expect(run.cost.tokens).toBeGreaterThan(0);
    expect(run.cost.estimatedUsd).toBeGreaterThan(0);
    expect(run.completedAt).toBeTruthy();
  });

  it("is reproducible: same seed yields identical observations", () => {
    const a = runObservations({ ...base, runId: "run-a", seed: 7 });
    const b = runObservations({ ...base, runId: "run-a", seed: 7 });
    expect(a.observations).toEqual(b.observations);
    expect(runVariance(a, b).identical).toBe(true);
  });

  it("produces controlled variation across different seeds", () => {
    const a = runObservations({ ...base, runId: "run-a", seed: 1 });
    const b = runObservations({ ...base, runId: "run-b", seed: 999 });
    const responsesA = a.observations.map((o) => o.rawResponse);
    const responsesB = b.observations.map((o) => o.rawResponse);
    expect(responsesA).not.toEqual(responsesB);
  });

  it("records every answer with a timestamp, platform and raw response", () => {
    const run = runObservations({ ...base, runId: "run-a", seed: 3 });
    for (const obs of run.observations) {
      expect(obs.observedAt).toBe(base.observedAt);
      expect(["ChatGPT", "Gemini", "Claude"]).toContain(obs.platform);
      expect(obs.rawResponse.length).toBeGreaterThan(0);
      expect(obs.isSimulated).toBe(true);
    }
  });

  it("marks the run failed and records errors when every answer throws", () => {
    const broken: AIAnswerProvider = {
      name: "broken",
      answer() {
        throw new Error("provider down");
      },
    };
    const run = runObservations({ ...base, runId: "run-x", seed: 5, provider: broken });
    expect(run.status).toBe("failed");
    expect(run.sampleSize).toBe(0);
    expect(run.errors.length).toBe(family.prompts.length);
  });
});

describe("runVariance", () => {
  it("reports a mention-rate delta between two runs", () => {
    const a = runObservations({ ...base, runId: "run-a", seed: 1 });
    const b = runObservations({ ...base, runId: "run-b", seed: 500 });
    const variance = runVariance(a, b);
    expect(variance.mentionRateDelta).toBeGreaterThanOrEqual(0);
    expect(variance.mentionRateDelta).toBeLessThanOrEqual(100);
  });
});
