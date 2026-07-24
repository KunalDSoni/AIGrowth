import { describe, expect, it } from "vitest";
import { getConfiguredEngines } from "@/lib/engines/geo-engine-registry";

describe("getConfiguredEngines", () => {
  it("always includes mock, labelled simulated", () => {
    const engines = getConfiguredEngines({});
    expect(engines.map((e) => e.name)).toEqual(["mock"]);
    expect(engines[0].measurement).toBe("simulated");
  });

  it("adds live engines as their keys appear, labelled measured", () => {
    const engines = getConfiguredEngines({
      PERPLEXITY_API_KEY: "k",
      OPENAI_API_KEY: "k",
      GEMINI_API_KEY: "k",
    });
    const names = engines.map((e) => e.name).sort();
    expect(names).toEqual(["gemini", "mock", "openai", "perplexity"]);
    for (const e of engines.filter((x) => x.name !== "mock")) {
      expect(e.measurement).toBe("measured");
    }
  });

  it("adds only the engines whose keys are present", () => {
    const engines = getConfiguredEngines({ PERPLEXITY_API_KEY: "k" });
    expect(engines.map((e) => e.name).sort()).toEqual(["mock", "perplexity"]);
  });
});
