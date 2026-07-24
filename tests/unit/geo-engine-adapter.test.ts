import { describe, expect, it } from "vitest";
import { answerEngineAsGeoProvider, GeminiAnswerEngine } from "@/lib/engines/geo-engine-adapter";
import type { AnswerEngineProvider, AnswerObservation } from "@/lib/providers/answer-engine";

function engine(obs: (prompt: string) => Partial<AnswerObservation>): AnswerEngineProvider {
  return {
    engines: ["fake"],
    async ask(prompt) {
      return {
        prompt,
        answer: "",
        citations: [],
        engine: "fake",
        source: "fake",
        measurement: "measured",
        measuredAt: "2026-07-24T00:00:00Z",
        ...obs(prompt),
      };
    },
  };
}

describe("answerEngineAsGeoProvider", () => {
  it("folds native citation urls into rawText so extraction classifies them", async () => {
    const provider = answerEngineAsGeoProvider(
      engine(() => ({ answer: "Consider Acme.", citations: [{ url: "https://rival.example/x" }] })),
      "fake",
      "Brand",
    );
    const { rawText } = await provider.answer("p1");
    expect(rawText).toContain("Consider Acme.");
    expect(rawText).toContain("https://rival.example/x");
    expect(provider.model).toBe("fake");
  });

  it("throws when the engine returns an error (so the probe is recorded unanswered)", async () => {
    const provider = answerEngineAsGeoProvider(engine(() => ({ error: "429 quota" })), "fake");
    await expect(provider.answer("p1")).rejects.toThrow(/429/);
  });

  it("wraps a gemini-shaped provider as an AnswerEngineProvider", async () => {
    const gem = new GeminiAnswerEngine({ async answer() { return { rawText: "Brand is listed." }; } });
    expect(gem.engines).toEqual(["gemini"]);
    const obs = await gem.ask("p1", { brand: "Brand" });
    expect(obs.answer).toBe("Brand is listed.");
    expect(obs.engine).toBe("gemini");
    expect(obs.measurement).toBe("measured");
    expect(obs.brandMentioned).toBe(true);
  });
});
